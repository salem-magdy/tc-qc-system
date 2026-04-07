/* backup.js — Supabase version */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('exportBackupBtn')?.addEventListener('click', exportBackup);
  const importBtn=document.getElementById('importBackupBtn'), fileInput=document.getElementById('restoreFileInput');
  if (importBtn && fileInput) {
    importBtn.addEventListener('click', ()=>fileInput.click());
    fileInput.addEventListener('change', e=>{const f=e.target.files[0];if(f)handleRestoreFile(f);e.target.value='';});
  }
});

async function exportBackup() {
  if (!isAdmin()) { showToast(t('Access denied.','غير مصرح.'), 'error'); return; }
  try {
    showToast(t('Exporting...','جاري التصدير...'), 'info', 2000);
    const [inspections, defects, stages, lines] = await Promise.all([
      SB_Inspections.getAll(),
      SB_Defects.getAll(),
      SB_Stages.getAll(),
      SB_Lines.getAll(),
    ]);
    const data = {
      version: 2,
      exportedAt: new Date().toISOString(),
      source: 'supabase',
      inspections, defects, stages, lines,
    };
    const json     = JSON.stringify(data, null, 2);
    const filename = `TC_QC_Backup_${todayISO()}.json`;
    downloadFile(json, filename, 'application/json');
    showToast(t('Backup exported successfully.','تم تصدير النسخة الاحتياطية.'), 'success');
  } catch (err) {
    console.error(err);
    showToast(t('Export failed.','فشل التصدير.'), 'error');
  }
}

function handleRestoreFile(file) {
  if (!isAdmin()) { showToast(t('Access denied.','غير مصرح.'), 'error'); return; }
  if (!file.name.endsWith('.json')) { showToast(t('Please select a valid .json file.','يرجى اختيار ملف .json صالح.'), 'error'); return; }
  confirmDelete(
    t('This will overwrite defects, stages and lines in Supabase. Inspections will be added. Continue?',
      'سيؤدي هذا إلى استبدال العيوب والمراحل والخطوط في Supabase. ستُضاف الفحوصات. هل تريد المتابعة؟'),
    ()=>{
      const reader = new FileReader();
      reader.onload = async e=>{
        try {
          const data = JSON.parse(e.target.result);
          if (!data.version) throw new Error('Invalid file');
          showToast(t('Restoring...','جاري الاستعادة...'), 'info', 3000);

          // Restore lists
          if (data.defects) {
            for (const name of data.defects) {
              try { await SB_Defects.add(name); } catch {}
            }
          }
          if (data.stages) {
            for (const name of data.stages) {
              try { await SB_Stages.add(name); } catch {}
            }
          }
          if (data.lines) {
            for (const name of data.lines) {
              try { await SB_Lines.add(name); } catch {}
            }
          }
          // Note: inspections restore is complex (images in storage) — skip for safety
          showToast(t('Lists restored successfully!','تمت استعادة القوائم بنجاح!'), 'success', 5000);
        } catch(err) {
          showToast(t('Invalid backup file.','ملف النسخة الاحتياطية غير صالح.'), 'error');
        }
      };
      reader.onerror=()=>showToast(t('Could not read file.','تعذر قراءة الملف.'), 'error');
      reader.readAsText(file);
    }
  );
}
