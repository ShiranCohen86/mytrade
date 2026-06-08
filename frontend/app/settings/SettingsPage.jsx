
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast/ToastProvider';
import { useTheme } from '@/hooks/useTheme';
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
  const { pref, setTheme } = useTheme();
  const { t, i18n } = useTranslation();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [nameSaving, setNameSaving] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  const isGoogle = Boolean(user?.isGoogleAccount);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    const name = displayName.trim();
    if (!name) return;
    setNameSaving(true);
    try {
      const { user: updated } = await updateProfile({ displayName: name });
      updateUser(updated);
      toast.success(t('settings.profileUpdated'));
    } catch (err) {
      toast.error(err.message || t('settings.failedUpdateProfile'));
    } finally {
      setNameSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPw.length < 8) {
      toast.warning(t('settings.pwTooShort'));
      return;
    }
    if (newPw !== confirmPw) {
      toast.warning(t('settings.pwMismatch'));
      return;
    }
    setPwSaving(true);
    try {
      await changePassword(currentPw, newPw);
      toast.success(t('settings.pwChanged'));
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      toast.error(err.message || t('settings.failedChangePw'));
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
      toast.error(err.message || t('settings.failedDelete'));
      setDeleting(false);
    }
  };

  const handleLangChange = (lang) => {
    i18n.changeLanguage(lang);
    try { localStorage.setItem('mytrade-lang', lang); } catch { /* noop */ }
  };

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <h1 className={styles.pageTitle}>{t('settings.title')}</h1>

        {/* Profile section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('settings.profile')}</h2>
          <div className={styles.profileRow}>
            <div className={styles.avatar}>
              <Initials name={user?.displayName} avatar={user?.avatar} />
            </div>
            <div className={styles.profileInfo}>
              <p className={styles.profileEmail}>{user?.email}</p>
              {isGoogle && <span className={styles.badge}>{t('settings.googleAccount')}</span>}
            </div>
          </div>
          <form onSubmit={handleProfileSave} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="displayName">{t('settings.displayName')}</label>
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
              {nameSaving ? t('settings.saving') : t('settings.saveName')}
            </button>
          </form>
        </section>

        {/* Preferences */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('settings.preferences')}</h2>

          {/* Appearance */}
          <div className={styles.prefRow}>
            <div className={styles.prefLabel}>
              <span className={styles.prefName}>{t('settings.appearance')}</span>
              <span className={styles.prefDesc}>{t('settings.appearanceDesc')}</span>
            </div>
            <div className={styles.themeToggleGroup}>
              <button
                className={`${styles.themeOption} ${pref === 'light' ? styles.themeOptionActive : ''}`}
                onClick={() => setTheme('light')}
                aria-pressed={pref === 'light'}
              >
                {t('settings.themeLight')}
              </button>
              <button
                className={`${styles.themeOption} ${pref === 'dark' ? styles.themeOptionActive : ''}`}
                onClick={() => setTheme('dark')}
                aria-pressed={pref === 'dark'}
              >
                {t('settings.themeDark')}
              </button>
              <button
                className={`${styles.themeOption} ${pref === 'system' ? styles.themeOptionActive : ''}`}
                onClick={() => setTheme('system')}
                aria-pressed={pref === 'system'}
              >
                {t('settings.themeSystem')}
              </button>
            </div>
          </div>

          {/* Language */}
          <div className={styles.prefRow}>
            <div className={styles.prefLabel}>
              <span className={styles.prefName}>{t('settings.language')}</span>
              <span className={styles.prefDesc}>{t('settings.languageDesc')}</span>
            </div>
            <div className={styles.themeToggleGroup}>
              <button
                className={`${styles.themeOption} ${i18n.language === 'en' ? styles.themeOptionActive : ''}`}
                onClick={() => handleLangChange('en')}
                aria-pressed={i18n.language === 'en'}
              >
                {t('settings.langEnglish')}
              </button>
              <button
                className={`${styles.themeOption} ${i18n.language === 'he' ? styles.themeOptionActive : ''}`}
                onClick={() => handleLangChange('he')}
                aria-pressed={i18n.language === 'he'}
              >
                {t('settings.langHebrew')}
              </button>
            </div>
          </div>
        </section>

        {/* Password section — only for non-Google users */}
        {!isGoogle && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('settings.changePassword')}</h2>
            <form onSubmit={handlePasswordChange} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="currentPw">{t('settings.currentPassword')}</label>
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
                <label className={styles.label} htmlFor="newPw">{t('settings.newPassword')}</label>
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
                <label className={styles.label} htmlFor="confirmPw">{t('settings.confirmNewPassword')}</label>
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
                {pwSaving ? t('settings.changing') : t('settings.changePassword')}
              </button>
            </form>
          </section>
        )}

        {/* Danger zone */}
        <section className={`${styles.section} ${styles.danger}`}>
          <h2 className={styles.sectionTitle}>{t('settings.dangerZone')}</h2>
          <p className={styles.dangerText}>{t('settings.dangerText')}</p>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="deleteConfirm">
              {t('settings.typeDelete')} <strong>{t('settings.deleteConfirm')}</strong> {t('settings.toConfirm')}
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
            {deleting ? t('settings.deleting') : t('settings.deleteAccount')}
          </button>
        </section>
      </div>
    </div>
  );
}
