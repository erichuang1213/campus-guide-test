import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.CAMPUS_SUPABASE_CONFIG;
const unavailable = message => ({ ok: false, message });

if (!config?.url || !config?.anonKey) {
  window.CampusBackend = { enabled: false, error: '尚未設定雲端資料庫。' };
} else {
  const client = createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  const normalizePlace = place => ({ ...place, id: place.id || crypto.randomUUID() });
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
      return (rows || []).map(row => row.data);
    },
    async syncPlaces(source) {
      const places = source.map(normalizePlace);
      source.splice(0, source.length, ...places);
      const oldRows = result(await client.from('places').select('id')) || [];
      if (places.length) {
        result(await client.from('places').upsert(places.map(place => ({ id: place.id, name: place.name, data: place })), { onConflict: 'id' }));
      }
      const keep = new Set(places.map(place => place.id));
      const removed = oldRows.map(row => row.id).filter(id => !keep.has(id));
      if (removed.length) result(await client.from('places').delete().in('id', removed));
      return places;
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
        menu_image: feedback.menuImage || null,
        menu_file_name: feedback.menuFileName || null,
        reporter_name: user?.user_metadata?.full_name || user?.user_metadata?.name || null,
        reporter_email: user?.email || null
      }));
    },
    async getFeedback() {
      return result(await client.from('feedback').select('*').order('created_at', { ascending: false }));
    },
    async clearFeedback() { result(await client.from('feedback').delete().neq('id', '00000000-0000-0000-0000-000000000000')); }
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

