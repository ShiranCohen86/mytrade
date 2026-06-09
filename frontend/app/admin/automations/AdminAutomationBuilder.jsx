import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/Toast/ToastProvider';
import {
  adminAutomationRegistry, adminCreateAutomation, adminUpdateAutomation, adminGetAutomation, adminTestAutomation,
} from '@/lib/apiClient';
import { TargetingSelector } from '../notifications/TargetingSelector';
import { NotificationPreview } from '../notifications/NotificationPreview';
import { AutoSubnav } from './AutoSubnav';
import styles from '../notifications/AdminNotifications.module.scss';
import auto from './automations.module.scss';

const CATEGORIES = ['watchlist_stock', 'user', 'ai_personalization', 'market', 'platform', 'engagement'];
const TYPES = ['info', 'success', 'warning', 'alert'];
const ICONS = ['📈', '📉', '🎯', '🚀', '🔥', '⚠️', '🔔', '💡', '📊', '📰', '💜', '✅'];
const OPERATORS = ['gte', 'lte', 'eq', 'neq'];

const EMPTY = {
  name: '', description: '', scope: 'global',
  trigger: { type: '', params: {} },
  conditions: { op: 'AND', items: [] },
  targeting: { mode: 'all', userIds: [], segment: null },
  actions: { channels: { inApp: true, push: false, email: false, sms: false, whatsapp: false }, content: { title: '', message: '', type: 'info', icon: '', deepLink: '', actionText: '' } },
  antiSpam: { cooldownMinutes: 1440, maxPerDay: 0, maxPerHour: 0, quietHours: { enabled: false, start: '22:00', end: '07:00', tz: 'America/New_York' }, dedupe: true },
  digest: { enabled: false, window: 'daily' },
  abTest: { enabled: false, variants: [] },
  status: 'paused',
};

export default function AdminAutomationBuilder() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const { id } = useParams();
  const [params] = useSearchParams();
  const isEdit = !!id;

  const [catalog, setCatalog] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [activeCat, setActiveCat] = useState('watchlist_stock');
  const [saving, setSaving] = useState(false);
  const [sim, setSim] = useState(null);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setTriggerParam = (k, v) => setForm((f) => ({ ...f, trigger: { ...f.trigger, params: { ...f.trigger.params, [k]: v } } }));

  useEffect(() => { adminAutomationRegistry().then((r) => setCatalog(r.triggers || [])).catch(() => {}); }, []);

  useEffect(() => {
    const uid = params.get('userId');
    if (uid && !isEdit) setForm((f) => ({ ...f, scope: 'user', targeting: { mode: 'single', userIds: [uid], segment: null } }));
  }, [params, isEdit]);

  useEffect(() => {
    if (!isEdit) return;
    adminGetAutomation(id).then(({ rule }) => {
      setForm({ ...EMPTY, ...rule, trigger: rule.trigger || EMPTY.trigger, conditions: rule.conditions || EMPTY.conditions, targeting: rule.targeting || EMPTY.targeting, actions: rule.actions || EMPTY.actions, antiSpam: { ...EMPTY.antiSpam, ...rule.antiSpam }, digest: { ...EMPTY.digest, ...rule.digest }, abTest: { ...EMPTY.abTest, ...rule.abTest } });
      if (rule.category) setActiveCat(rule.category); // surface the saved trigger under the right category tab
    }).catch(() => toast.error(t('autom.loadFailed')));
  }, [id, isEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedDef = useMemo(() => catalog.find((c) => c.key === form.trigger.type) || null, [catalog, form.trigger.type]);
  const byCat = useMemo(() => catalog.filter((c) => c.category === activeCat), [catalog, activeCat]);

  // Insertable variables grouped by who they refer to (recipient vs the new user vs
  // stock/market), preserving the trigger's token order, so the picker reads clearly.
  const tokenGroups = useMemo(() => {
    const order = [];
    const map = new Map();
    ((selectedDef && selectedDef.tokens) || []).forEach((tk) => {
      const g = tk.group || 'other';
      if (!map.has(g)) { map.set(g, []); order.push(g); }
      map.get(g).push(tk);
    });
    return order.map((g) => ({ group: g, tokens: map.get(g) }));
  }, [selectedDef]);

  const selectTrigger = (def) => {
    if (!def.feasible) { toast.warning(t('autom.needsDataToast')); }
    const p = {};
    (def.paramSchema || []).forEach((ps) => { p[ps.name] = ps.default; });
    set({ trigger: { type: def.key, params: p } });
  };

  const addCond = () => set({ conditions: { ...form.conditions, items: [...form.conditions.items, { field: '', operator: 'gte', value: '' }] } });
  const updateCond = (i, patch) => set({ conditions: { ...form.conditions, items: form.conditions.items.map((c, j) => (j === i ? { ...c, ...patch } : c)) } });
  const removeCond = (i) => set({ conditions: { ...form.conditions, items: form.conditions.items.filter((_, j) => j !== i) } });

  const toggleChannel = (ch) => set({ actions: { ...form.actions, channels: { ...form.actions.channels, [ch]: !form.actions.channels[ch] } } });
  const setContent = (k, v) => set({ actions: { ...form.actions, content: { ...form.actions.content, [k]: v } } });
  const setAnti = (patch) => set({ antiSpam: { ...form.antiSpam, ...patch } });

  // Insert a {{token}} into whichever content field (title/message) was last focused, at the caret.
  const titleRef = useRef(null);
  const msgRef = useRef(null);
  const [focusedField, setFocusedField] = useState('message');
  const insertToken = useCallback((token) => {
    const field = focusedField === 'title' ? 'title' : 'message';
    const el = field === 'title' ? titleRef.current : msgRef.current;
    const snippet = `{{${token}}}`;
    setForm((f) => {
      const cur = f.actions.content[field] || '';
      let next; let caret;
      if (el && typeof el.selectionStart === 'number') {
        const s = el.selectionStart; const e = el.selectionEnd;
        next = cur.slice(0, s) + snippet + cur.slice(e);
        caret = s + snippet.length;
      } else { next = cur + snippet; caret = next.length; }
      requestAnimationFrame(() => { if (el) { el.focus(); try { el.setSelectionRange(caret, caret); } catch { /* noop */ } } });
      return { ...f, actions: { ...f.actions, content: { ...f.actions.content, [field]: next } } };
    });
  }, [focusedField]);

  const validate = () => {
    if (!form.name.trim()) return t('autom.errName');
    if (!form.trigger.type) return t('autom.errTrigger');
    const c = form.actions.channels;
    if (!c.inApp && !c.push && !c.email && !c.sms && !c.whatsapp) return t('autom.errChannel');
    if (form.actions.content.deepLink && !form.actions.content.deepLink.startsWith('/')) return t('autom.errDeepLink');
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      const res = isEdit ? await adminUpdateAutomation(id, form) : await adminCreateAutomation(form);
      toast.success(isEdit ? t('autom.saved') : t('autom.created'));
      navigate(`/admin/automations/${res.rule._id}`);
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };

  const test = async () => {
    if (!isEdit) { toast.info(t('autom.saveBeforeTest')); return; }
    try { setSim(await adminTestAutomation(id)); } catch (e) { toast.error(e.message); }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.headTitle}>{isEdit ? t('autom.editTitle') : t('autom.newTitle')}</h1>
          <p className={styles.headSub}>{t('autom.builderSub')}</p>
        </div>
        <div className={styles.headActions}>
          <button className="btn btn-ghost" onClick={() => navigate('/admin/automations')}>{t('autom.cancel')}</button>
        </div>
      </div>

      <AutoSubnav />

      <div className={styles.composeGrid}>
        <div className={styles.form}>
          {/* Name */}
          <div className={styles.section}>
            <div className={styles.field}>
              <label className={styles.label}>{t('autom.ruleName')}</label>
              <input className={styles.textInput} value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder={t('autom.ruleNamePh')} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>{t('autom.description')}</label>
              <input className={styles.textInput} value={form.description} onChange={(e) => set({ description: e.target.value })} />
            </div>
          </div>

          {/* WHEN — trigger */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>{t('autom.when')}</div>
            <div className={auto.catTabs}>
              {CATEGORIES.map((c) => (
                <button key={c} className={`${auto.catTab} ${activeCat === c ? auto.catTabActive : ''}`} onClick={() => setActiveCat(c)}>
                  {t(`autom.category.${c}`)}
                </button>
              ))}
            </div>
            <div className={auto.triggerGrid}>
              {byCat.map((def) => (
                <button
                  key={def.key}
                  className={`${auto.triggerCard} ${form.trigger.type === def.key ? auto.triggerCardActive : ''} ${def.feasible ? '' : auto.triggerCardDisabled}`}
                  onClick={() => selectTrigger(def)}
                  type="button"
                >
                  <div className={auto.triggerName}>{def.label}{!def.feasible && <span className={auto.feasBadge}>{t('autom.soon')}</span>}</div>
                  <div className={auto.triggerDesc}>{def.description}</div>
                </button>
              ))}
            </div>

            {/* Params */}
            {selectedDef && (selectedDef.paramSchema || []).length > 0 && (
              <div className={auto.paramGrid} style={{ marginTop: 16 }}>
                {selectedDef.paramSchema.map((ps) => (
                  <div className={styles.field} key={ps.name}>
                    <label className={styles.label}>{ps.label || ps.name}</label>
                    {ps.type === 'select' ? (
                      <select className={styles.select} value={form.trigger.params[ps.name] ?? ps.default} onChange={(e) => setTriggerParam(ps.name, e.target.value)}>
                        {(ps.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        className={styles.textInput}
                        type={ps.type === 'number' ? 'number' : 'text'}
                        value={form.trigger.params[ps.name] ?? (ps.default ?? '')}
                        onChange={(e) => setTriggerParam(ps.name, ps.type === 'number' ? e.target.value : (ps.type === 'ticker' ? e.target.value.toUpperCase() : e.target.value))}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Extra AND/OR conditions */}
            {selectedDef && (
              <div style={{ marginTop: 16 }}>
                <label className={styles.label}>{t('autom.extraConditions')}</label>
                {form.conditions.items.length > 0 && (
                  <div className={auto.opToggle}>
                    {['AND', 'OR'].map((op) => (
                      <button key={op} type="button" className={`${auto.opBtn} ${form.conditions.op === op ? auto.opBtnActive : ''}`} onClick={() => set({ conditions: { ...form.conditions, op } })}>{op}</button>
                    ))}
                  </div>
                )}
                {form.conditions.items.map((c, i) => (
                  <div className={auto.condRow} key={i}>
                    <input className={styles.textInput} placeholder="stock.analysis.riskScore" value={c.field} onChange={(e) => updateCond(i, { field: e.target.value })} />
                    <select className={styles.select} value={c.operator} onChange={(e) => updateCond(i, { operator: e.target.value })}>
                      {OPERATORS.map((o) => <option key={o} value={o}>{t(`autom.op.${o}`)}</option>)}
                    </select>
                    <input className={styles.textInput} placeholder={t('autom.value')} value={c.value} onChange={(e) => updateCond(i, { value: e.target.value })} />
                    <button className={auto.removeBtn} onClick={() => removeCond(i)} type="button" aria-label="remove">×</button>
                  </div>
                ))}
                <button className={auto.addCond} type="button" onClick={addCond}>+ {t('autom.addCondition')}</button>
              </div>
            )}
          </div>

          {/* THEN — channels + content */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>{t('autom.then')}</div>
            <div className={styles.channelCards}>
              {[['inApp', '🔔', t('adminNotif.channelInApp')], ['push', '📲', t('adminNotif.channelPush')]].map(([ch, ic, label]) => (
                <div key={ch} className={`${styles.channelCard} ${form.actions.channels[ch] ? styles.channelCardActive : ''}`} onClick={() => toggleChannel(ch)}>
                  <span className={styles.channelIcon}>{ic}</span>
                  <span className={styles.channelText}><span className={styles.channelName}>{label}</span></span>
                  <input type="checkbox" className={styles.channelCheck} checked={form.actions.channels[ch]} readOnly />
                </div>
              ))}
            </div>
            <div className={styles.channelCards} style={{ marginTop: 8, opacity: 0.55 }}>
              {[['email', '✉️', 'Email'], ['sms', '💬', 'SMS'], ['whatsapp', '🟢', 'WhatsApp']].map(([ch, ic, label]) => (
                <div key={ch} className={styles.channelCard} title={t('autom.channelSoon')}>
                  <span className={styles.channelIcon}>{ic}</span>
                  <span className={styles.channelText}><span className={styles.channelName}>{label}</span><span className={styles.channelDesc}>{t('autom.soon')}</span></span>
                </div>
              ))}
            </div>

            <p className={styles.headSub} style={{ margin: '14px 0 8px' }}>{t('autom.contentHint')}</p>
            <div className={styles.field}>
              <label className={styles.label}>{t('adminNotif.fieldTitle')}</label>
              <input ref={titleRef} className={styles.textInput} value={form.actions.content.title} onFocus={() => setFocusedField('title')} onChange={(e) => setContent('title', e.target.value)} placeholder="{{ticker}} is up {{changePercent}}%" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>{t('adminNotif.fieldMessage')}</label>
              <textarea ref={msgRef} className={styles.textarea} value={form.actions.content.message} onFocus={() => setFocusedField('message')} onChange={(e) => setContent('message', e.target.value)} />
            </div>

            {/* Insertable variables — grouped by who they refer to, with readable labels */}
            {selectedDef && tokenGroups.length > 0 && (
              <div className={styles.field}>
                <label className={styles.label}>{t('autom.variablesLabel')}</label>
                <div className={auto.tokenGroups}>
                  {tokenGroups.map(({ group, tokens }) => (
                    <div key={group} className={auto.tokenGroup}>
                      <div className={auto.tokenGroupHead}>{t(`autom.varGroup.${group}`, group)}</div>
                      <div className={auto.tokenRow}>
                        {tokens.map((tk) => (
                          <button
                            key={`${group}:${tk.token}`}
                            type="button"
                            className={auto.tokenChip}
                            title={`{{${tk.token}}}`}
                            onClick={() => insertToken(tk.token)}
                          >
                            <span className={auto.tokenChipLabel}>{t(`autom.var.${group}.${tk.token}`, tk.label)}</span>
                            <span className={auto.tokenChipCode}>{`{{${tk.token}}}`}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className={styles.headSub} style={{ marginTop: 6 }}>{t('autom.variablesHint')}</p>
              </div>
            )}
            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>{t('adminNotif.fieldType')}</label>
                <select className={styles.select} value={form.actions.content.type} onChange={(e) => setContent('type', e.target.value)}>
                  {TYPES.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>{t('adminNotif.fieldDeepLink')}</label>
                <input className={styles.textInput} value={form.actions.content.deepLink} onChange={(e) => setContent('deepLink', e.target.value)} placeholder="/stocks/{{ticker}}" />
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>{t('adminNotif.fieldIcon')}</label>
              <div className={styles.iconRow}>
                {ICONS.map((ic) => <button key={ic} type="button" className={`${styles.iconBtn} ${form.actions.content.icon === ic ? styles.iconBtnActive : ''}`} onClick={() => setContent('icon', ic)}>{ic}</button>)}
              </div>
            </div>
          </div>

          {/* Targeting */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>{t('autom.whoTargeting')}</div>
            <TargetingSelector value={form.targeting} onChange={(targeting) => set({ targeting })} showWatchlistHolders />
          </div>

          {/* Anti-spam */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>{t('autom.antiSpam')}</div>
            <div className={auto.antiGrid}>
              <div className={styles.field}>
                <label className={styles.label}>{t('autom.cooldown')}</label>
                <input type="number" className={styles.textInput} value={form.antiSpam.cooldownMinutes} onChange={(e) => setAnti({ cooldownMinutes: +e.target.value })} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>{t('autom.maxPerHour')}</label>
                <input type="number" className={styles.textInput} value={form.antiSpam.maxPerHour} onChange={(e) => setAnti({ maxPerHour: +e.target.value })} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>{t('autom.maxPerDay')}</label>
                <input type="number" className={styles.textInput} value={form.antiSpam.maxPerDay} onChange={(e) => setAnti({ maxPerDay: +e.target.value })} />
              </div>
            </div>
            <label className={auto.switchRow}>
              <input type="checkbox" checked={form.antiSpam.quietHours.enabled} onChange={(e) => setAnti({ quietHours: { ...form.antiSpam.quietHours, enabled: e.target.checked } })} />
              {t('autom.quietHours')}
              {form.antiSpam.quietHours.enabled && (
                <>
                  <input type="time" className={styles.textInput} style={{ width: 110 }} value={form.antiSpam.quietHours.start} onChange={(e) => setAnti({ quietHours: { ...form.antiSpam.quietHours, start: e.target.value } })} />
                  <input type="time" className={styles.textInput} style={{ width: 110 }} value={form.antiSpam.quietHours.end} onChange={(e) => setAnti({ quietHours: { ...form.antiSpam.quietHours, end: e.target.value } })} />
                </>
              )}
            </label>
            <label className={auto.switchRow}>
              <input type="checkbox" checked={form.antiSpam.dedupe} onChange={(e) => setAnti({ dedupe: e.target.checked })} />
              {t('autom.dedupe')}
            </label>
            <label className={auto.switchRow}>
              <input type="checkbox" checked={form.digest.enabled} onChange={(e) => set({ digest: { ...form.digest, enabled: e.target.checked } })} />
              {t('autom.smartDigest')}
              {form.digest.enabled && (
                <select className={styles.select} style={{ width: 130 }} value={form.digest.window} onChange={(e) => set({ digest: { ...form.digest, window: e.target.value } })}>
                  <option value="daily">{t('autom.daily')}</option>
                  <option value="weekly">{t('autom.weekly')}</option>
                </select>
              )}
            </label>
          </div>

          <div className={styles.formActions}>
            {isEdit && <button className="btn btn-secondary" onClick={test}>{t('autom.testDry')}</button>}
            <button className="btn btn-primary" disabled={saving} onClick={save}>{isEdit ? t('autom.saveChanges') : t('autom.createPaused')}</button>
          </div>

          {sim && (
            <div className={auto.simResult}>
              <strong>{t('autom.simMatched', { count: sim.count })}</strong>
              {sim.matched.map((mm, i) => (
                <div className={auto.matchRow} key={i}>
                  <span>{mm.email}{mm.ticker ? ` · ${mm.ticker}` : ''}</span>
                  <span>{mm.preview?.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preview */}
        <aside className={styles.previewPanel}>
          <div className={styles.previewTitle}>{t('adminNotif.livePreview')}</div>
          <NotificationPreview content={{ ...form.actions.content }} />
        </aside>
      </div>
    </div>
  );
}
