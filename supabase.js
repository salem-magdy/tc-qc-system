/* ============================================================
   supabase.js — Supabase Client + All DB Operations
   Replaces db.js (LocalStorage) and ImageDB (IndexedDB)
   ============================================================ */

const SUPABASE_URL  = 'https://nfjioffkvfnndhrhkctw.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mamlvZmZrdmZubmRocmhrY3R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MjI5OTYsImV4cCI6MjA5MDk5ODk5Nn0.Swa6f-DK0EO9m4tNjH6yNjxCFAZ3OVydDJjJYvunfAk';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ============================================================
   AUTH
   ============================================================ */

const SB_Auth = {

  async signUp(username, password) {
    const email = `${username.toLowerCase()}@tcqc.com`;
    const { data, error } = await _supabase.auth.signUp({
      email,
      password,
      options: { data: { username } }
    });
    if (error) throw error;
    return data;
  },

  async signIn(username, password) {
    const email = `${username.toLowerCase()}@tcqc.com`;
    const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    await _supabase.auth.signOut();
  },

  async getSession() {
    const { data } = await _supabase.auth.getSession();
    return data.session;
  },

  async getUser() {
    const { data } = await _supabase.auth.getUser();
    return data.user;
  },

  onAuthStateChange(callback) {
    return _supabase.auth.onAuthStateChange(callback);
  },
};

/* ============================================================
   PROFILES (users)
   ============================================================ */

const SB_Profiles = {

  async getAll() {
    const { data, error } = await _supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async getById(id) {
    const { data, error } = await _supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data;
  },

  async getByUsername(username) {
    const { data, error } = await _supabase
      .from('profiles')
      .select('*')
      .ilike('username', username)
      .single();
    if (error) return null;
    return data;
  },

  async updateRole(id, role) {
    const { error } = await _supabase
      .from('profiles')
      .update({ role })
      .eq('id', id);
    if (error) throw error;
  },

  async delete(id) {
    // Delete from auth (cascades to profiles)
    const { error } = await _supabase.auth.admin.deleteUser(id);
    if (error) throw error;
  },
};

/* ============================================================
   INSPECTIONS
   ============================================================ */

const SB_Inspections = {

  async getAll() {
    const { data, error } = await _supabase
      .from('inspections')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapInspFromDB);
  },

  async getById(id) {
    const { data, error } = await _supabase
      .from('inspections')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return mapInspFromDB(data);
  },

  async create(insp) {
    const { data, error } = await _supabase
      .from('inspections')
      .insert([mapInspToDB(insp)])
      .select()
      .single();
    if (error) throw error;
    return mapInspFromDB(data);
  },

  async update(id, updates) {
    const { error } = await _supabase
      .from('inspections')
      .update(mapInspToDB(updates))
      .eq('id', id);
    if (error) throw error;
  },

  async delete(id) {
    const { error } = await _supabase
      .from('inspections')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

// Map DB snake_case → app camelCase
function mapInspFromDB(row) {
  if (!row) return null;
  return {
    id:             row.id,
    style:          row.style,
    po:             row.po,
    washing:        row.washing,
    line:           row.line,
    quantity:       row.quantity,
    inspector:      row.inspector,
    date:           row.date,
    result:         row.result,
    notes:          row.notes,
    defects:        row.defects || [],
    imageIds:       row.image_ids || [],
    reInspOrigId:   row.re_insp_orig_id,
    createdBy:      row.created_by,
    createdAt:      row.created_at,
    lastEditedBy:   row.last_edited_by,
    lastEditedAt:   row.last_edited_at,
  };
}

// Map app camelCase → DB snake_case
function mapInspToDB(insp) {
  const obj = {};
  if (insp.style         !== undefined) obj.style            = insp.style;
  if (insp.po            !== undefined) obj.po               = insp.po;
  if (insp.washing       !== undefined) obj.washing          = insp.washing;
  if (insp.line          !== undefined) obj.line             = insp.line;
  if (insp.quantity      !== undefined) obj.quantity         = insp.quantity || null;
  if (insp.inspector     !== undefined) obj.inspector        = insp.inspector;
  if (insp.date          !== undefined) obj.date             = insp.date;
  if (insp.result        !== undefined) obj.result           = insp.result;
  if (insp.notes         !== undefined) obj.notes            = insp.notes || null;
  if (insp.defects       !== undefined) obj.defects          = insp.defects || [];
  if (insp.imageIds      !== undefined) obj.image_ids        = insp.imageIds || [];
  if (insp.reInspOrigId  !== undefined) obj.re_insp_orig_id  = insp.reInspOrigId || null;
  if (insp.createdBy     !== undefined) obj.created_by       = insp.createdBy;
  if (insp.createdAt     !== undefined) obj.created_at       = insp.createdAt;
  if (insp.lastEditedBy  !== undefined) obj.last_edited_by   = insp.lastEditedBy;
  if (insp.lastEditedAt  !== undefined) obj.last_edited_at   = insp.lastEditedAt;
  return obj;
}

/* ============================================================
   DEFECTS LIST
   ============================================================ */

const SB_Defects = {

  async getAll() {
    const { data, error } = await _supabase
      .from('defects_list')
      .select('name')
      .order('name');
    if (error) throw error;
    return (data || []).map(d => d.name);
  },

  async add(name) {
    const { error } = await _supabase
      .from('defects_list')
      .insert([{ name }]);
    if (error) throw error;
  },

  async update(oldName, newName) {
    const { error } = await _supabase
      .from('defects_list')
      .update({ name: newName })
      .eq('name', oldName);
    if (error) throw error;
  },

  async remove(name) {
    const { error } = await _supabase
      .from('defects_list')
      .delete()
      .eq('name', name);
    if (error) throw error;
  },
};

/* ============================================================
   STAGES LIST
   ============================================================ */

const SB_Stages = {

  async getAll() {
    const { data, error } = await _supabase
      .from('stages_list')
      .select('name')
      .order('name');
    if (error) throw error;
    return (data || []).map(s => s.name);
  },

  async add(name) {
    const { error } = await _supabase
      .from('stages_list')
      .insert([{ name }]);
    if (error) throw error;
  },

  async update(oldName, newName) {
    const { error } = await _supabase
      .from('stages_list')
      .update({ name: newName })
      .eq('name', oldName);
    if (error) throw error;
  },

  async remove(name) {
    const { error } = await _supabase
      .from('stages_list')
      .delete()
      .eq('name', name);
    if (error) throw error;
  },
};

/* ============================================================
   LINES
   ============================================================ */

const SB_Lines = {

  async getAll() {
    const { data, error } = await _supabase
      .from('lines')
      .select('name')
      .order('name');
    if (error) throw error;
    return (data || []).map(l => l.name);
  },

  async add(name) {
    const { error } = await _supabase
      .from('lines')
      .insert([{ name }]);
    if (error) throw error;
  },

  async remove(name) {
    const { error } = await _supabase
      .from('lines')
      .delete()
      .eq('name', name);
    if (error) throw error;
  },
};

/* ============================================================
   SETTINGS
   ============================================================ */

const SB_Settings = {

  async get(userId) {
    const { data } = await _supabase
      .from('settings')
      .select('*')
      .eq('user_id', userId)
      .single();
    return data || { theme: 'dark', lang: 'en' };
  },

  async save(userId, updates) {
    const { error } = await _supabase
      .from('settings')
      .upsert({ user_id: userId, ...updates });
    if (error) throw error;
  },
};

/* ============================================================
   IMAGE STORAGE (Supabase Storage)
   ============================================================ */

const SB_Images = {

  BUCKET: 'inspection-images',

  async upload(base64, fileName) {
    // Convert base64 to blob
    const res   = await fetch(base64);
    const blob  = await res.blob();
    const path  = `${fileName}`;

    const { error } = await _supabase.storage
      .from(this.BUCKET)
      .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
    return path;
  },

  async getUrl(path) {
    const { data } = await _supabase.storage
      .from(this.BUCKET)
      .createSignedUrl(path, 60 * 60); // 1 hour
    return data?.signedUrl || null;
  },

  async delete(path) {
    await _supabase.storage
      .from(this.BUCKET)
      .remove([path]);
  },

  async deleteMany(paths) {
    if (!paths || paths.length === 0) return;
    await _supabase.storage
      .from(this.BUCKET)
      .remove(paths);
  },
};

/* ============================================================
   IMAGE COMPRESSION UTILITY (unchanged)
   ============================================================ */

const ImageUtil = {
  compress(file, maxWidth = 1200, quality = 0.78) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width, h = img.height;
          if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  newId() {
    return 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  },
};

/* ============================================================
   REAL-TIME SUBSCRIPTION
   ============================================================ */

const SB_Realtime = {
  _channel: null,

  subscribeToInspections(callback) {
    this._channel = _supabase
      .channel('inspections_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'inspections' },
        callback
      )
      .subscribe();
  },

  unsubscribe() {
    if (this._channel) {
      _supabase.removeChannel(this._channel);
      this._channel = null;
    }
  },
};

console.log('[Supabase] Client initialized ✓');
