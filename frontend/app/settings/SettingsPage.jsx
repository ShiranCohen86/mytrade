
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast/ToastProvider';
import { updateProfile, changePassword, deleteAccount } from '@/lib/apiClient';
import styles from './SettingsPage.module.scss';

function Initials({ name, avatar }) {
  if (avatar) return <img src={avatar} alt={name} className={styles.avatarImg} />;
  const letters = (name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return <span className={styles.avatarLetters}>{letters}</span>;
}

export default function SettingsPage() {
  const { user, updateUser, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [nameSaving, setNameSaving] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  const isGoogle = Boolean(user?.googleId);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    const name = displayName.trim();
    if (!name) return;
    setNameSaving(true);
    try {
      const updated = await updateProfile({ displayName: name });
      updateUser(updated);
      toast.success('Profile updated.');
    } catch (err) {
      toast.error(err.message || 'Failed to update profile.');
    } finally {
      setNameSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPw.length < 8) {
      toast.warning('New password must be at least 8 characters.');
      return;
    }
    if (newPw !== confirmPw) {
      toast.warning('Passwords do not match.');
      return;
    }
    setPwSaving(true);
    try {
      await changePassword(currentPw, newPw);
      toast.success('Password changed successfully.');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      toast.error(err.message || 'Failed to change password.');
    } finally {
      setPwSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteInput !== 'DELETE') return;
    setDeleting(true);
    try {
      await deleteAccount();
      logout();
      navigate('/');
    } catch (err) {
      toast.error(err.message || 'Failed to delete account.');
      setDeleting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <h1 className={styles.pageTitle}>Settings</h1>

        {/* Profile section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Profile</h2>
          <div className={styles.profileRow}>
            <div className={styles.avatar}>
              <Initials name={user?.displayName} avatar={user?.avatar} />
            </div>
            <div className={styles.profileInfo}>
              <p className={styles.profileEmail}>{user?.email}</p>
              {isGoogle && <span className={styles.badge}>Google account</span>}
            </div>
          </div>
          <form onSubmit={handleProfileSave} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="displayName">Display name</label>
              <input
                id="displayName"
                className={styles.input}
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={60}
                disabled={nameSaving}
              />
            </div>
            <button type="submit" className={styles.btnPrimary} disabled={nameSaving || !displayName.trim()}>
              {nameSaving ? 'Saving…' : 'Save name'}
            </button>
          </form>
        </section>

        {/* Password section — only for non-Google users */}
        {!isGoogle && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Change password</h2>
            <form onSubmit={handlePasswordChange} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="currentPw">Current password</label>
                <input
                  id="currentPw"
                  className={styles.input}
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  disabled={pwSaving}
                  autoComplete="current-password"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="newPw">New password</label>
                <input
                  id="newPw"
                  className={styles.input}
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  disabled={pwSaving}
                  autoComplete="new-password"
                  minLength={8}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="confirmPw">Confirm new password</label>
                <input
                  id="confirmPw"
                  className={styles.input}
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  disabled={pwSaving}
                  autoComplete="new-password"
                />
              </div>
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={pwSaving || !currentPw || !newPw || !confirmPw}
              >
                {pwSaving ? 'Changing…' : 'Change password'}
              </button>
            </form>
          </section>
        )}

        {/* Danger zone */}
        <section className={`${styles.section} ${styles.danger}`}>
          <h2 className={styles.sectionTitle}>Danger zone</h2>
          <p className={styles.dangerText}>
            Permanently delete your account and all data. This cannot be undone.
          </p>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="deleteConfirm">
              Type <strong>DELETE</strong> to confirm
            </label>
            <input
              id="deleteConfirm"
              className={styles.input}
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="DELETE"
              disabled={deleting}
              spellCheck={false}
            />
          </div>
          <button
            className={styles.btnDanger}
            onClick={handleDeleteAccount}
            disabled={deleting || deleteInput !== 'DELETE'}
          >
            {deleting ? 'Deleting…' : 'Delete my account'}
          </button>
        </section>
      </div>
    </div>
  );
}
