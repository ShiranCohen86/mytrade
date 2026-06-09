import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/Toast/ToastProvider';
import {
  adminListTemplates, adminCreateTemplate, adminUpdateTemplate,
  adminDuplicateTemplate, adminArchiveTemplate,
} from '@/lib/apiClient';
import { NotifSubnav } from './NotifSubnav';
import styles from './AdminNotifications.module.scss';

const TYPES = ['info', 'success', 'warning', 'alert'];
const KEYS = ['welcome', 'feature_update', 'market_alert', 'system_alert', 'breaking_news', 'maintenance', 'engagement_reminder', 'reactivation'];
const ICONS = ['📢', '🎉', '✨', '📈', '⚠️', '🚨', '🔔', '🛠️', '💜', '✅'];

const EMPTY = {
  name: '', key: 'system_alert', title: '', message: '', type: 'info', icon: '📢',
  deepLink: '', actionText: '', defaultChannels: { push: false, inApp: true },
};

function TemplateModal({ initial, onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState(initial || EMPTY);
  const [saving, setSaving] = useState(false);
  const set = (p) => setForm((f) => ({ ...f, ...p }));
  const editing = !!initial?._id;

  const save = async () => {
    if (!form.name.trim()) { toast.error(t('adminNotif.errTemplateName')); return; }
    setSaving(true);
    try {
      if (editing) await adminUpdateTemplate(initial._id, form);
      else await adminCreateTemplate(form);
      toast.success(t('adminNotif.templateSaved'));
      onSaved();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <h2 className={styles.modalTitle}>{editing ? t('adminNotif.editTemplate') : t('adminNotif.newTemplate')}</h2>
        <div className={styles.field} style={{ marginTop: 16 }}>
          <label className={styles.label}>{t('adminNotif.templateName')}</label>
          <input className={styles.textInput} value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div className={styles.row2}>
          <div className={styles.field}>
            <label className={styles.label}>{t('adminNotif.templateKey')}</label>
            <select className={styles.select} value={form.key} onChange={(e) => set({ key: e.target.value })}>
              {KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>{t('adminNotif.fieldType')}</label>
            <select className={styles.select} value={form.type} onChange={(e) => set({ type: e.target.value })}>
              {TYPES.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
            </select>
          </div>
        </div>
        <div className={styles.field}>
          <label className={styles.label}>{t('adminNotif.fieldIcon')}</label>
          <div className={styles.iconRow}>
            {ICONS.map((ic) => (
              <button key={ic} type="button" className={`${styles.iconBtn} ${form.icon === ic ? styles.iconBtnActive : ''}`} onClick={() => set({ icon: ic })}>{ic}</button>
            ))}
          </div>
        </div>
        <div className={styles.field}>
          <label className={styles.label}>{t('adminNotif.fieldTitle')}</label>
          <input className={styles.textInput} value={form.title} onChange={(e) => set({ title: e.target.value })} />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>{t('adminNotif.fieldMessage')}</label>
          <textarea className={styles.textarea} value={form.message} onChange={(e) => set({ message: e.target.value })} />
        </div>
        <div className={styles.row2}>
          <div className={styles.field}>
            <label className={styles.label}>{t('adminNotif.fieldDeepLink')}</label>
            <input className={styles.textInput} value={form.deepLink} onChange={(e) => set({ deepLink: e.target.value })} placeholder="/dashboard" />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>{t('adminNotif.fieldAction')}</label>
            <input className={styles.textInput} value={form.actionText} onChange={(e) => set({ actionText: e.target.value })} />
          </div>
        </div>
        <div className={styles.modalActions}>
          <button className="btn btn-ghost" onClick={onClose}>{t('adminNotif.cancel')}</button>
          <button className="btn btn-primary" disabled={saving} onClick={save}>{t('adminNotif.save')}</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminNotificationTemplates() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  const [statusTab, setStatusTab] = useState('active');
  const [modal, setModal] = useState(null); // null | {} | template

  const load = useCallback(() => {
    adminListTemplates(statusTab).then((r) => setTemplates(r.templates || [])).catch(() => {});
  }, [statusTab]);

  useEffect(() => { load(); }, [load]);

  const duplicate = async (id) => {
    try { await adminDuplicateTemplate(id); toast.success(t('adminNotif.duplicated')); load(); }
    catch (err) { toast.error(err.message); }
  };
  const archive = async (id, archived) => {
    try { await adminArchiveTemplate(id, archived); load(); }
    catch (err) { toast.error(err.message); }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.headTitle}>{t('adminNotif.templatesTitle')}</h1>
          <p className={styles.headSub}>{t('adminNotif.templatesSub')}</p>
        </div>
        <div className={styles.headActions}>
          <button className="btn btn-primary" onClick={() => setModal({})}>+ {t('adminNotif.newTemplate')}</button>
        </div>
      </div>

      <NotifSubnav />

      <div className={styles.modeTabs}>
        <button className={`${styles.modeTab} ${statusTab === 'active' ? styles.modeTabActive : ''}`} onClick={() => setStatusTab('active')}>{t('adminNotif.activeTab')}</button>
        <button className={`${styles.modeTab} ${statusTab === 'archived' ? styles.modeTabActive : ''}`} onClick={() => setStatusTab('archived')}>{t('adminNotif.archivedTab')}</button>
      </div>

      {templates.length === 0 ? (
        <div className={styles.empty}><span className={styles.emptyIcon}>🗂️</span>{t('adminNotif.noTemplates')}</div>
      ) : (
        <div className={styles.templateGrid}>
          {templates.map((tpl) => (
            <div key={tpl._id} className={styles.templateCard}>
              <div className={styles.templateHead}>
                <span className={styles.templateIcon}>{tpl.icon}</span>
                <span className={styles.templateName}>{tpl.name}</span>
                {tpl.isSystem && <span className={styles.sysTag}>{t('adminNotif.system')}</span>}
              </div>
              <div className={styles.templateMsg}>{tpl.message}</div>
              <div className={styles.templateActions}>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/admin/notifications/new?template=${tpl._id}`)}>{t('adminNotif.use')}</button>
                <button className={styles.iconAction} title={t('adminNotif.edit')} onClick={() => setModal(tpl)} aria-label="edit">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" /></svg>
                </button>
                <button className={styles.iconAction} title={t('adminNotif.duplicate')} onClick={() => duplicate(tpl._id)} aria-label="duplicate">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                </button>
                {!tpl.isSystem && (
                  <button className={styles.iconAction} title={tpl.status === 'archived' ? t('adminNotif.unarchive') : t('adminNotif.archive')} onClick={() => archive(tpl._id, tpl.status !== 'archived')} aria-label="archive">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" /></svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <TemplateModal
          initial={modal._id ? modal : null}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}
