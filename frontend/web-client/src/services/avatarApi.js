/**
 * Avatar API — Web client helper for avatar CRUD.
 * Uses the Vite proxy (/api → gateway:4000).
 */

export async function getAvatars() {
  try {
    const res = await fetch('/api/avatars');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export async function createCustomAvatar(avatarData) {
  try {
    const res = await fetch('/api/avatars/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(avatarData),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export async function deleteCustomAvatar(id) {
  try {
    const res = await fetch(`/api/avatars/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
