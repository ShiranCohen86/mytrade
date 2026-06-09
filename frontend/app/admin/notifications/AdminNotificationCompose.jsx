import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/Toast/ToastProvider';
import {
  adminCreateCampaign, adminUpdateCampaign, adminGetCampaign,
  adminPreviewRecipients, adminListTemplates, adminGetUsers,
} from '@/lib/apiClient';
import { NotificationPreview } from './NotificationPreview';
import { TargetingSelector } from './TargetingSelector';
import { ConfirmSendModal } from './ConfirmSendModal';
import { NotifSubnav } from './NotifSubnav';
import styles from './AdminNotifications.module.scss';

const TYPES = ['info', 'success', 'warning', 'alert'];
const ICONS = ['📢', '🎉', '✨', '📈', '⚠️', '🚨', '🔔', '🛠️', '💜', '✅', 'ℹ️', '🟢'];

const EMPTY = {
  title: '', message: '', type: 'info', icon: '📢', imageUrl: '', deepLink: '', actionText: '', expiresAt: '',
  channels: { push: false, inApp: true },
  audience: { mode: 'all', userIds: [], segment: null },
};

export default function AdminNotificationCompose() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const { id } = useParams();
  const [params] = useSearchParams();
  const isEdit = !!id;

  const [form, setForm] = useState(EMPTY);
  const [sendMode, setSendMode] = useState('now'); // now | schedule | draft
  const [scheduledAt, setScheduledAt] = useState('');
  const [templates, setTemplates] = useState([]);
  const [recipientCount, setRecipientCount] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef(null);
  const appliedTemplateRef = useRef(false);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // Load templates (for "start from template") and, in edit mode, the campaign.
  useEffect(() => {
    adminListTemplates('active').then((r) => setTemplates(r.templates || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    adminGetCampaign(id).then(({ campaign: c }) => {
      setForm({
        title: c.title, message: c.message, type: c.type, icon: c.icon || '📢',
        imageUrl: c.imageUrl || '', deepLink: c.deepLink || '', actionText: c.actionText || '',
        expiresAt: c.expiresAt ? c.expiresAt.slice(0, 16) : '',
        channels: { push: !!c.channels?.push, inApp: !!c.channels?.inApp },
        audience: { mode: c.audience?.mode || 'all', userIds: (c.audience?.userIds || []).map(String), segment: c.audience?.segment || null },
      });
      if (c.status === 'scheduled') { setSendMode('schedule'); if (c.scheduledAt) setScheduledAt(c.scheduledAt.slice(0, 16)); }
      else if (c.status === 'draft') setSendMode('draft');
    }).catch(() => toast.error(t('adminNotif.loadFailed')));
  }, [id, isEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyTemplate = useCallback((tpl) => {
    set({
      title: tpl.title, message: tpl.message, type: tpl.type, icon: tpl.icon || '📢',
      imageUrl: tpl.imageUrl || '', deepLink: tpl.deepLink || '', actionText: tpl.actionText || '',
      channels: { push: !!tpl.defaultChannels?.push, inApp: !!tpl.defaultChannels?.inApp },
    });
    toast.info(t('adminNotif.templateApplied', { name: tpl.name }));
  }, [toast, t]);

  // Prefill from ?template=ID once templates are loaded — apply exactly once
  // so a re-run never re-fires applyTemplate (which would toast/vibrate again).
  useEffect(() => {
    if (appliedTemplateRef.current) return;
    const tid = params.get('template');
    if (tid && templates.length) {
      const tpl = templates.find((x) => x._id === tid);
      if (tpl) { appliedTemplateRef.current = true; applyTemplate(tpl); }
    }
  }, [params, templates, applyTemplate]);

  // Live recipient count (debounced) whenever audience changes.
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      adminPreviewRecipients(form.audience)
        .then(({ count }) => setRecipientCount(count))
        .catch(() => setRecipientCount(null));
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [form.audience]);

  const audienceValid = () => {
    const a = form.audience;
    if (a.mode === 'segment') return !!a.segment;
    if (a.mode === 'single' || a.mode === 'multiple') return (a.userIds || []).length > 0;
    return a.mode === 'all';
  };

  const validate = () => {
    if (!form.title.trim()) return t('adminNotif.errTitle');
    if (!form.message.trim()) return t('adminNotif.errMessage');
    if (!form.channels.push && !form.channels.inApp) return t('adminNotif.errChannel');
    if (form.deepLink && !form.deepLink.startsWith('/')) return t('adminNotif.errDeepLink');
    if (!audienceValid()) return t('adminNotif.errAudience');
    if (sendMode === 'schedule' && (!scheduledAt || new Date(scheduledAt) <= new Date())) return t('adminNotif.errSchedule');
    return null;
  };

  const buildDto = (mode) => ({
    ...form,
    expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
    sendMode: mode,
    scheduledAt: mode === 'schedule' && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const doSave = async (mode) => {
    setSaving(true);
    try {
      if (isEdit) {
        await adminUpdateCampaign(id, buildDto(sendMode));
        toast.success(t('adminNotif.saved'));
        navigate(`/admin/notifications/${id}`);
      } else {
        const { campaign } = await adminCreateCampaign(buildDto(mode));
        toast.success(mode === 'draft' ? t('adminNotif.draftSaved') : mode === 'schedule' ? t('adminNotif.scheduled') : t('adminNotif.sent'));
        navigate(mode === 'draft' ? '/admin/notifications' : `/admin/notifications/${campaign._id}`);
      }
    } catch (err) {
      toast.error(err.message || t('adminNotif.saveFailed'));
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  };

  const onPrimary = () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    if (isEdit) { doSave(sendMode); return; }
    if (sendMode === 'draft') { doSave('draft'); return; }
    setConfirmOpen(true); // confirm before send / schedule
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.headTitle}>{isEdit ? t('adminNotif.editTitle') : t('adminNotif.composeTitle')}</h1>
          <p className={styles.headSub}>{t('adminNotif.composeSub')}</p>
        </div>
        <div className={styles.headActions}>
          <button className="btn btn-ghost" onClick={() => navigate('/admin/notifications')}>{t('adminNotif.cancel')}</button>
        </div>
      </div>

      <NotifSubnav />

      <div className={styles.composeGrid}>
        <div className={styles.form}>
          {/* Template starter */}
          {!isEdit && templates.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>{t('adminNotif.startFromTemplate')}</div>
              <div className={styles.iconRow}>
                {templates.map((tpl) => (
                  <button key={tpl._id} className={styles.radioCard} onClick={() => applyTemplate(tpl)} type="button">
                    <span>{tpl.icon}</span> {tpl.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Content */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>{t('adminNotif.content')}</div>

            <div className={styles.field}>
              <label className={styles.label}>{t('adminNotif.fieldTitle')}
                <span className={styles.charCount}>{form.title.length}/120</span>
              </label>
              <input className={styles.textInput} maxLength={120} value={form.title}
                onChange={(e) => set({ title: e.target.value })} placeholder={t('adminNotif.fieldTitlePh')} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>{t('adminNotif.fieldMessage')}
                <span className={styles.charCount}>{form.message.length}/1000</span>
              </label>
              <textarea className={styles.textarea} maxLength={1000} value={form.message}
                onChange={(e) => set({ message: e.target.value })} placeholder={t('adminNotif.fieldMessagePh')} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>{t('adminNotif.fieldType')}</label>
              <div className={styles.typeRow}>
                {TYPES.map((tp) => (
                  <button key={tp} type="button"
                    className={`${styles.typeBtn} ${form.type === tp ? styles.typeBtnActive : ''}`}
                    onClick={() => set({ type: tp })}>
                    {t(`notifications.type.${tp}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>{t('adminNotif.fieldIcon')}</label>
              <div className={styles.iconRow}>
                {ICONS.map((ic) => (
                  <button key={ic} type="button"
                    className={`${styles.iconBtn} ${form.icon === ic ? styles.iconBtnActive : ''}`}
                    onClick={() => set({ icon: ic })}>{ic}</button>
                ))}
              </div>
            </div>

            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>{t('adminNotif.fieldDeepLink')}</label>
                <input className={styles.textInput} value={form.deepLink}
                  onChange={(e) => set({ deepLink: e.target.value })} placeholder="/dashboard" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>{t('adminNotif.fieldAction')}</label>
                <input className={styles.textInput} maxLength={40} value={form.actionText}
                  onChange={(e) => set({ actionText: e.target.value })} placeholder={t('adminNotif.fieldActionPh')} />
              </div>
            </div>

            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>{t('adminNotif.fieldImage')}</label>
                <input className={styles.textInput} value={form.imageUrl}
                  onChange={(e) => set({ imageUrl: e.target.value })} placeholder="https://…" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>{t('adminNotif.fieldExpiry')}</label>
                <input type="datetime-local" className={styles.textInput} value={form.expiresAt}
                  onChange={(e) => set({ expiresAt: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Channels */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>{t('adminNotif.channels')}</div>
            <div className={styles.channelCards}>
              <div className={`${styles.channelCard} ${form.channels.inApp ? styles.channelCardActive : ''}`}
                onClick={() => set({ channels: { ...form.channels, inApp: !form.channels.inApp } })}>
                <span className={styles.channelIcon}>🔔</span>
                <span className={styles.channelText}>
                  <span className={styles.channelName}>{t('adminNotif.channelInApp')}</span>
                  <span className={styles.channelDesc}>{t('adminNotif.channelInAppDesc')}</span>
                </span>
                <input type="checkbox" className={styles.channelCheck} checked={form.channels.inApp} readOnly />
              </div>
              <div className={`${styles.channelCard} ${form.channels.push ? styles.channelCardActive : ''}`}
                onClick={() => set({ channels: { ...form.channels, push: !form.channels.push } })}>
                <span className={styles.channelIcon}>📲</span>
                <span className={styles.channelText}>
                  <span className={styles.channelName}>{t('adminNotif.channelPush')}</span>
                  <span className={styles.channelDesc}>{t('adminNotif.channelPushDesc')}</span>
                </span>
                <input type="checkbox" className={styles.channelCheck} checked={form.channels.push} readOnly />
              </div>
            </div>
          </div>

          {/* Targeting */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>{t('adminNotif.targeting')}</div>
            <TargetingSelector value={form.audience} onChange={(audience) => set({ audience })} />
            {recipientCount != null && (
              <div className={styles.countPill}>👥 {t('adminNotif.recipientsCount', { count: recipientCount })}</div>
            )}
          </div>

          {/* Scheduling */}
          {!isEdit && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>{t('adminNotif.delivery')}</div>
              <div className={styles.radioRow}>
                {['now', 'schedule', 'draft'].map((m) => (
                  <button key={m} type="button"
                    className={`${styles.radioCard} ${sendMode === m ? styles.radioCardActive : ''}`}
                    onClick={() => setSendMode(m)}>
                    {t(`adminNotif.send.${m}`)}
                  </button>
                ))}
              </div>
              {sendMode === 'schedule' && (
                <div className={styles.field}>
                  <label className={styles.label}>{t('adminNotif.scheduleTime')} · {Intl.DateTimeFormat().resolvedOptions().timeZone}</label>
                  <input type="datetime-local" className={styles.textInput} value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)} />
                </div>
              )}
            </div>
          )}

          <div className={styles.formActions}>
            {!isEdit && sendMode !== 'draft' && (
              <button className="btn btn-secondary" disabled={saving} onClick={() => doSave('draft')}>
                {t('adminNotif.saveDraft')}
              </button>
            )}
            <button className="btn btn-primary" disabled={saving} onClick={onPrimary}>
              {isEdit ? t('adminNotif.saveChanges')
                : sendMode === 'now' ? t('adminNotif.reviewSend')
                : sendMode === 'schedule' ? t('adminNotif.reviewSchedule')
                : t('adminNotif.saveDraft')}
            </button>
          </div>
        </div>

        {/* Live preview */}
        <aside className={styles.previewPanel}>
          <div className={styles.previewTitle}>{t('adminNotif.livePreview')}</div>
          <NotificationPreview content={form} />
        </aside>
      </div>

      {confirmOpen && (
        <ConfirmSendModal
          content={form}
          audience={form.audience}
          sendMode={sendMode}
          scheduledAt={scheduledAt}
          recipientCount={recipientCount}
          saving={saving}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => doSave(sendMode)}
        />
      )}
    </div>
  );
}
