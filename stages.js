/* stages.js — Supabase version */
'use strict';
let stageEditTarget = null;

async function renderStagesList() {
  if (!canManage()) { showToast(t('Access denied.','غير مصرح.'), 'error'); navigate('dashboard'); return; }
  let stages = [];
  try { stages = await SB_Stages.getAll(); } catch { showToast(t('Failed to load.','فشل التحميل.'), 'error'); return; }
  const tbody=document.getElementById('stagesListBody'), emptyEl=document.getElementById('stagesEmpty');
  if (!tbody) return;
  if (!stages.length) { tbody.innerHTML=''; if(emptyEl) emptyEl.style.display=''; }
  else {
    if(emptyEl) emptyEl.style.display='none';
    tbody.innerHTML = stages.map((name,idx)=>`<tr>
      <td style="color:var(--text-muted);font-size:13px">${idx+1}</td>
      <td><strong>📍 ${escapeHtml(name)}</strong></td>
      <td><div class="row-actions">
        <button class="action-btn" onclick="openEditStage('${escapeHtml(name)}')">${t('Edit','تعديل')}</button>
        <button class="action-btn danger" onclick="deleteStageItem('${escapeHtml(name)}')">${t('Delete','حذف')}</button>
      </div></td></tr>`).join('');
  }
  bindStagesEvents();
}
function bindStagesEvents() {
  document.getElementById('addStageBtn')?.addEventListener('click', openAddStage);
  document.getElementById('save-stage-btn')?.addEventListener('click', saveStage);
  document.getElementById('cancel-stage-btn')?.addEventListener('click', ()=>closeModal('stage-modal'));
  document.getElementById('stage-modal-input')?.addEventListener('keydown', e=>{if(e.key==='Enter')saveStage();});
}
function openAddStage() {
  stageEditTarget=null;
  setModalStage(t('Add Stage','إضافة مرحلة'),'',t('Add','إضافة'));
  openModal('stage-modal');
}
function openEditStage(name) {
  stageEditTarget=name;
  setModalStage(t('Edit Stage','تعديل المرحلة'),name,t('Save','حفظ'));
  openModal('stage-modal');
}
function setModalStage(title,val,btnText) {
  const el=id=>document.getElementById(id);
  if(el('stage-modal-title'))el('stage-modal-title').textContent=title;
  if(el('stage-modal-input'))el('stage-modal-input').value=val;
  if(el('stage-modal-err'))  el('stage-modal-err').textContent='';
  if(el('save-stage-btn'))   el('save-stage-btn').textContent=btnText;
}
async function saveStage() {
  const input=document.getElementById('stage-modal-input'), errEl=document.getElementById('stage-modal-err');
  const newName=input?.value.trim()||'';
  if(!newName){if(errEl)errEl.textContent=t('Stage name is required.','اسم المرحلة مطلوب.');return;}
  try {
    if(stageEditTarget===null){await SB_Stages.add(newName);showToast(t('Stage added.','تم إضافة المرحلة.'),'success');}
    else{await SB_Stages.update(stageEditTarget,newName);showToast(t('Stage updated.','تم تحديث المرحلة.'),'success');}
    closeModal('stage-modal'); renderStagesList();
  } catch(err){if(errEl)errEl.textContent=err.message?.includes('unique')?t('Already exists.','موجودة بالفعل.'):err.message;}
}
function deleteStageItem(name) {
  confirmDelete(t(`Remove stage "${name}"?`,`إزالة المرحلة "${name}"؟`), async()=>{
    try{await SB_Stages.remove(name);showToast(t('Stage removed.','تمت الإزالة.'),'success');renderStagesList();}
    catch{showToast(t('Error.','خطأ.'),'error');}
  });
}
