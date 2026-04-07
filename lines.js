/* lines.js — Supabase version */
'use strict';

async function renderLinesList() {
  if (!canManage()) { showToast(t('Access denied.','غير مصرح.'), 'error'); navigate('dashboard'); return; }
  let lines = [];
  try { lines = await SB_Lines.getAll(); } catch { showToast(t('Failed to load.','فشل التحميل.'), 'error'); return; }
  const tbody=document.getElementById('linesBody'), emptyEl=document.getElementById('linesEmpty');
  if (!tbody) return;
  if (!lines.length) { tbody.innerHTML=''; if(emptyEl) emptyEl.style.display=''; }
  else {
    if(emptyEl) emptyEl.style.display='none';
    tbody.innerHTML = lines.map((name,idx)=>`<tr>
      <td style="color:var(--text-muted);font-size:13px">${idx+1}</td>
      <td><strong>${t('Line','خط')} ${escapeHtml(name)}</strong></td>
      <td><button class="action-btn danger" onclick="deleteLineItem('${escapeHtml(name)}')">${t('Delete','حذف')}</button></td>
    </tr>`).join('');
  }
  bindLinesEvents();
}
function bindLinesEvents() {
  document.getElementById('addLineBtn')?.addEventListener('click', openAddLine);
  document.getElementById('save-line-btn')?.addEventListener('click', saveLine);
  document.getElementById('cancel-line-btn')?.addEventListener('click', ()=>closeModal('line-modal'));
  document.getElementById('line-modal-input')?.addEventListener('keydown', e=>{if(e.key==='Enter')saveLine();});
}
function openAddLine() {
  const input=document.getElementById('line-modal-input'), err=document.getElementById('line-modal-err');
  if(input) input.value=''; if(err) err.textContent='';
  openModal('line-modal');
}
async function saveLine() {
  const input=document.getElementById('line-modal-input'), errEl=document.getElementById('line-modal-err');
  const value=input?.value.trim()||'';
  if(!value){if(errEl)errEl.textContent=t('Line name is required.','اسم الخط مطلوب.');return;}
  try {
    await SB_Lines.add(value);
    showToast(t(`Line ${value} added.`,`تم إضافة الخط ${value}.`),'success');
    closeModal('line-modal'); renderLinesList();
  } catch(err){if(errEl)errEl.textContent=err.message?.includes('unique')?t('This line already exists.','هذا الخط موجود بالفعل.'):err.message;}
}
function deleteLineItem(line) {
  confirmDelete(
    t(`Remove Line ${line}? Existing inspections will not be affected.`,`إزالة الخط ${line}؟ لن تتأثر الفحوصات.`),
    async()=>{
      try{await SB_Lines.remove(line);showToast(t(`Line ${line} removed.`,`تم إزالة الخط ${line}.`),'success');renderLinesList();}
      catch{showToast(t('Error.','خطأ.'),'error');}
    }
  );
}
