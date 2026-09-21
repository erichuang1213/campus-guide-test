import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.CAMPUS_SUPABASE_CONFIG;
const unavailable = message => ({ ok: false, message });

if (!config?.url || !config?.anonKey) {
  window.CampusBackend = { enabled: false, error: '尚未設定雲端資料庫。' };
} else {
  const client = createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  const stringList = value => {
    const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[|、，,]/) : [];
    return [...new Set(values.map(item => String(item || '').trim()).filter(Boolean))];
  };
  const normalizePeriods = value => (Array.isArray(value) ? value : [])
    .map(slot => ({ open: String(slot?.open || '').trim(), close: String(slot?.close || '').trim() }))
    .filter(slot => slot.open || slot.close);
  const normalizePlace = place => {
    const raw = place || {};
    const tags = stringList(raw.tags);
    const category = String(raw.category || '').trim();
    return {
      ...raw,
      id: raw.id || crypto.randomUUID(),
      name: String(raw.name || '').trim(),
      category,
      tags: category && !tags.includes(category) ? [category, ...tags] : tags,
      days: [...new Set((Array.isArray(raw.days) ? raw.days : []).map(Number).filter(day => Number.isInteger(day) && day >= 0 && day <= 6))],
      periods: normalizePeriods(raw.periods),
      menuImages: stringList(raw.menuImages)
    };
  };
  const result = ({ data, error }) => {
    if (error) throw error;
    return data;
  };

  window.CampusBackend = {
    enabled: true,
    client,
    async session() { return result(await client.auth.getSession()).session; },
    async signIn(email, password) { return result(await client.auth.signInWithPassword({ email, password })); },
    async signInWithGoogle(redirectTo = window.location.href) {
      return result(await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } }));
    },
    async signUp(email, password) { return result(await client.auth.signUp({ email, password })); },
    async signOut() { return result(await client.auth.signOut()); },
    async claimAdmin() {
      const session = await this.session();
      if (!session) throw new Error('請先登入。');
      if (await this.isAdmin()) return true;
      await client.from('admins').insert({ user_id: session.user.id }).throwOnError();
      return true;
    },
    async isAdmin() {
      const session = await this.session();
      if (!session) return false;
      const { data, error } = await client.from('admins').select('user_id').eq('user_id', session.user.id).maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    async getPlaces() {
      const rows = result(await client.from('places').select('data').order('updated_at', { ascending: false }));
      return (rows || []).map(row => normalizePlace(row.data));
    },
    async syncPlaces(source) {
      const places = source.map(normalizePlace);
      source.splice(0, source.length, ...places);
      if (places.length) {
        result(await client.from('places').upsert(places.map(place => ({ id: place.id, name: place.name, data: place })), { onConflict: 'id' }));
      }
      return places;
    },
    async savePlace(place) {
      const normalized = normalizePlace(place);
      result(await client.from('places').upsert({ id: normalized.id, name: normalized.name, data: normalized }, { onConflict: 'id' }));
      return normalized;
    },
    async deletePlace(id) {
      result(await client.from('places').delete().eq('id', id));
    },
    async getCandidates() {
      const rows = result(await client.from('pending_candidates').select('id, data').order('created_at', { ascending: true }));
      return (rows || []).map(row => ({ ...row.data, id: row.id }));
    },
    async removeCandidate(id) {
      result(await client.from('pending_candidates').delete().eq('id', id));
    },
    async uploadMenuImage(file, placeId) {
      const session = await this.session();
      if (!session) throw new Error('請先登入管理員帳號。');
      const extension = (file.name.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase();
      const path = `${session.user.id}/${placeId}/${crypto.randomUUID()}.${extension}`;
      result(await client.storage.from('menu-images').upload(path, file, {
        contentType: file.type || 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      }));
      return client.storage.from('menu-images').getPublicUrl(path).data.publicUrl;
    },
    async getSettings() {
      const row = result(await client.from('site_settings').select('custom_tags').eq('id', 1).maybeSingle());
      return row?.custom_tags || [];
    },
    async saveSettings(customTags) {
      result(await client.from('site_settings').upsert({ id: 1, custom_tags: customTags }, { onConflict: 'id' }));
    },
    async submitFeedback(feedback) {
      const session = await this.session();
      const user = session?.user;
      result(await client.from('feedback').insert({
        type: feedback.type,
        message: feedback.text,
        place_name: feedback.placeName || null,
        menu_image: feedback.menuImage || null,
        menu_file_name: feedback.menuFileName || null
      }));
    },
    async getFeedback() {
      return result(await client.from('feedback').select('*').order('created_at', { ascending: false }));
    },
    async clearFeedback() { result(await client.from('feedback').delete().neq('id', '00000000-0000-0000-0000-000000000000')); }
    ,async updateFeedbackStatus(id, status) {
      result(await client.from('feedback').update({
        status,
        resolved_at: status === '已完成' ? new Date().toISOString() : null
      }).eq('id', id));
    }
    ,async getConfirmations(placeNames) {
      if (!placeNames?.length) return [];
      return result(await client.from('place_confirmations').select('place_name,status,confirmed_at').in('place_name', placeNames).order('confirmed_at', { ascending: false }));
    }
    ,async confirmPlace(placeName, status = '資訊正確') {
      const session = await this.session();
      if (!session) throw new Error('請先使用 Google 登入後再確認。');
      result(await client.from('place_confirmations').insert({ place_name: placeName, status }));
    }
  };
}

