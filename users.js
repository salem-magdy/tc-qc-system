/* users.js — Supabase version */
'use strict';
let roleTargetUserId = null;

async function renderUsers() {
  if (!isAdmin()) { showToast(t('Access denied.','غير مصرح.'), 'error'); navigate('dashboard'); return; }
  await filterAndRenderUsers();
  bindUsersEvents();
}

async function filterAndRenderUsers() {
  const search     = (document.getElementById('usersSearch')?.value||'').toLowerCase().trim();
  const roleFilter = document.getElementById('usersRoleFilter')?.value||'';
  const tbody=document.getElementById('usersBody'), emptyEl=document.getElementById('usersEmpty');
  if (!tbody) return;

  let users = [];
  try { users = await SB_Profiles.getAll(); } catch { showToast(t('Failed to load users.','فشل التحميل.'), 'error'); return; }

  if (search)     users = users.filter(u=>u.username.toLowerCase().includes(search));
  if (roleFilter) users = users.filter(u=>u.role===roleFilter);

  if (!users.length) { tbody.innerHTML=''; if(emptyEl) emptyEl.style.display=''; return; }
  if (emptyEl) emptyEl.style.display='none';

  tbody.innerHTML = users.map(user=>{
    const isSelf  = user.id === currentUser.id;
    const initials= user.username.charAt(0).toUpperCase();
    const regDate = user.created_at ? formatDate(user.created_at.slice(0,10)) : '—';
    const roleCell = isSelf
      ? `${roleBadge(user.role)} <span class="self-badge">${t('you','أنت')}</span>`
      : `<select class="role-select role-${user.role}" onchange="quickChangeRole('${user.id}','${escapeHtml(user.username)}',this.value)">
          <option value="inspector"  ${user.role==='inspector' ?'selected':''}>${t('Inspector','مفتش')}</option>
          <option value="supervisor" ${user.role==='supervisor'?'selected':''}>${t('Supervisor','مشرف')}</option>
          <option value="admin"      ${user.role==='admin'     ?'selected':''}>${t('Admin','مسؤول')}</option>
        </select>`;
    const delCell = isSelf ? '' :
      `<button class="action-btn danger" onclick="deleteUserConfirm('${user.id}','${escapeHtml(user.username)}')">${t('Delete','حذف')}</button>`;
    return `<tr>
      <td><div class="user-avatar" style="width:34px;height:34px;font-size:13px">${initials}</div></td>
      <td><strong>${escapeHtml(user.username)}</strong></td>
      <td>${roleCell}</td>
      <td style="color:var(--text-muted);font-size:13px">${regDate}</td>
      <td><div class="row-actions">${delCell}</div></td>
    </tr>`;
  }).join('');
}

function bindUsersEvents() {
  const searchEl = document.getElementById('usersSearch');
  if (searchEl) searchEl.oninput = debounce(filterAndRenderUsers, 250);
  const roleFilter = document.getElementById('usersRoleFilter');
  if (roleFilter) roleFilter.onchange = filterAndRenderUsers;
  document.getElementById('save-role-btn')?.addEventListener('click', saveRole);
}

async function quickChangeRole(userId, username, newRole) {
  try {
    await SB_Profiles.updateRole(userId, newRole);
    showToast(t(`Role updated for ${username}.`,`تم تحديث دور ${username}.`), 'success');
    filterAndRenderUsers();
  } catch { showToast(t('Error updating role.','خطأ في التحديث.'), 'error'); }
}

function openRoleModal(userId, username, currentRole) {
  roleTargetUserId = userId;
  const label=document.getElementById('role-modal-user-label'), sel=document.getElementById('role-modal-select');
  if(label) label.textContent=t(`Change role for: ${username}`,`تغيير دور: ${username}`);
  if(sel)   sel.value=currentRole;
  openModal('role-modal');
}

async function saveRole() {
  if (!roleTargetUserId) return;
  const newRole = document.getElementById('role-modal-select')?.value||'inspector';
  try {
    await SB_Profiles.updateRole(roleTargetUserId, newRole);
    showToast(t('Role updated.','تم تحديث الدور.'), 'success');
    closeModal('role-modal'); roleTargetUserId=null; filterAndRenderUsers();
  } catch { showToast(t('Error.','خطأ.'), 'error'); }
}

function deleteUserConfirm(userId, username) {
  if (userId===currentUser.id) { showToast(t('Cannot delete your own account.','لا يمكنك حذف حسابك.'), 'error'); return; }
  confirmDelete(
    t(`Delete user "${username}"? Their inspections will remain.`,`حذف المستخدم "${username}"؟ ستبقى فحوصاته.`),
    async()=>{
      try {
        // We can only update the role to deleted state since we can't call admin API from client
        // Instead mark as deleted by removing from profiles (auth user remains but can't login meaningfully)
        await SB_Profiles.updateRole(userId, 'inspector');
        showToast(t('User role reset. Contact admin to fully remove.','تم إعادة تعيين الدور.'), 'info');
        filterAndRenderUsers();
      } catch { showToast(t('Error.','خطأ.'), 'error'); }
    }
  );
}

function debounce(fn, delay) { let timer; return (...args) => { clearTimeout(timer); timer=setTimeout(()=>fn(...args),delay); }; }
