/* defects.js — Supabase version */
'use strict';
let defectEditTarget = null;

async function renderDefectsList() {
  if (!canManage()) { showToast(t('Access denied.','غير مصرح.'), 'error'); navigate('dashboard'); return; }
  let defects = [];
  try { defects = await SB_Defects.getAll(); } catch { showToast(t('Failed to load.','فشل التحميل.'), 'error'); return; }
  const tbody=document.getElementById('defectsListBody'), emptyEl=document.getElementById('defectsEmpty');
  if (!tbody) return;
  if (!defects.length) { tbody.innerHTML=''; if(emptyEl) emptyEl.style.display=''; }
  else {
    if(emptyEl) emptyEl.style.display='none';
    tbody.innerHTML = defects.map((name,idx)=>`<tr>
      <td style="color:var(--text-muted);font-size:13px">${idx+1}</td>
      <td><strong>${escapeHtml(name)}</strong></td>
      <td><div class="row-actions">
        <button class="action-btn" onclick="openEditDefect('${escapeHtml(name)}')">${t('Edit','تعديل')}</button>
        <button class="action-btn danger" onclick="deleteDefectItem('${escapeHtml(name)}')">${t('Delete','حذف')}</button>
      </div></td></tr>`).join('');
  }
  bindDefectsEvents();
}
function bindDefectsEvents() {
  document.getElementById('addDefectListBtn')?.addEventListener('click', openAddDefect);
  document.getElementById('save-defect-btn')?.addEventListener('click', saveDefect);
  document.getElementById('cancel-defect-btn')?.addEventListener('click', ()=>closeModal('defect-modal'));
  document.getElementById('defect-modal-input')?.addEventListener('keydown', e=>{if(e.key==='Enter')saveDefect();});
}
function openAddDefect() {
  defectEditTarget=null;
  setModalDefect(t('Add Defect','إضافة عيب'), '', t('Add','إضافة'));
  openModal('defect-modal');
}
function openEditDefect(name) {
  defectEditTarget=name;
  setModalDefect(t('Edit Defect','تعديل العيب'), name, t('Save','حفظ'));
  openModal('defect-modal');
}
function setModalDefect(title, val, btnText) {
  const el = id => document.getElementById(id);
  if(el('defect-modal-title')) el('defect-modal-title').textContent=title;
  if(el('defect-modal-input')) el('defect-modal-input').value=val;
  if(el('defect-modal-err'))   el('defect-modal-err').textContent='';
  if(el('save-defect-btn'))    el('save-defect-btn').textContent=btnText;
}
async function saveDefect() {
  const input=document.getElementById('defect-modal-input'), errEl=document.getElementById('defect-modal-err');
  const newName=input?.value.trim()||'';
  if(!newName){if(errEl)errEl.textContent=t('Defect name is required.','اسم العيب مطلوب.');return;}
  try {
    if(defectEditTarget===null){await SB_Defects.add(newName);showToast(t('Defect added.','تم إضافة العيب.'),'success');}
    else{await SB_Defects.update(defectEditTarget,newName);showToast(t('Defect updated.','تم تحديث العيب.'),'success');}
    closeModal('defect-modal'); renderDefectsList();
  } catch(err){if(errEl)errEl.textContent=err.message?.includes('unique')?t('Already exists.','موجود بالفعل.'):err.message;}
}
function deleteDefectItem(name) {
  confirmDelete(t(`Remove "${name}"?`,`إزالة "${name}"؟`), async()=>{
    try{await SB_Defects.remove(name);showToast(t('Defect removed.','تمت الإزالة.'),'success');renderDefectsList();}
    catch{showToast(t('Error.','خطأ.'),'error');}
  });
}
