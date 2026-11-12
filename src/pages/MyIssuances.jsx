import React, { useState } from 'react';
import { useData } from '../data/DataContext.jsx';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import { IcLock } from '../components/icons.jsx';

function fd(d) { return d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'; }

export default function MyIssuances() {
  const { g, s, logActivity } = useData();
  const { currentUser } = useAuth();
  const toast = useToast();
  const forms = g('forms');
  const issuances = g('issuances').filter(i => i.userId === currentUser.id).sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt));
  const funds = g('funds').length ? g('funds') : ['General Fund', 'General/SEF', 'Trust Fund', 'CEC'];
  const [fundStub, setFundStub] = useState(null); // { formId, stubIdx }
  const [noteStub, setNoteStub] = useState(null); // { formId, stubIdx } — stub whose Details note is being edited
  const FN = () => currentUser.firstName + ' ' + currentUser.lastName;

  // Free-text "Details" the user attaches to a stub. Stored on the stub as `stubNote`; the RCD
  // filing screen reads it from there. Unlike Fund, it is never locked.
  function saveNote(formId, stubIdx, text) {
    const list = forms.slice();
    const fi = list.findIndex(f => f.id === formId);
    if (fi < 0 || !list[fi].stubs?.[stubIdx]) return 'Stub not found.';
    const stub = list[fi].stubs[stubIdx];
    const iss = g('issuances').find(i => i.id === stub.issuanceId);
    if (!iss || iss.userId !== currentUser.id) return 'This stub is not issued to you.';
    const stubs = list[fi].stubs.slice();
    stubs[stubIdx] = { ...stub, stubNote: text || null };
    list[fi] = { ...list[fi], stubs };
    s('forms', list);
    logActivity('Edit Stub Details', `${FN()} updated the details of a ${list[fi].name} stub`, FN());
    toast('Details saved.', 'ok');
    setNoteStub(null);
    return null;
  }

  function saveFund(formId, stubIdx, value, isDivided, otherValue) {
    const list = forms.slice();
    const fi = list.findIndex(f => f.id === formId);
    if (fi < 0 || !list[fi].stubs?.[stubIdx]) return 'Stub not found.';
    const stubs = list[fi].stubs.slice();
    stubs[stubIdx] = { ...stubs[stubIdx], fund: value, isDivided, splitFund: isDivided ? otherValue : null };
    list[fi] = { ...list[fi], stubs };
    s('forms', list);
    logActivity('Set Fund', `${FN()} set fund to "${value}"${isDivided ? ` (divided with "${otherValue}")` : ''} for ${list[fi].name} stub`, FN());
    toast('Fund saved.', 'ok');
    setFundStub(null);
    return null;
  }

  const rows = [];
  issuances.forEach(iss => {
    const f = forms.find(x => x.id === iss.formId) || {};
    const isSerial = f.formType === 'serial';
    const formStubs = (f.stubs || []).map((st, fi) => ({ ...st, _fi: fi })).filter(st => st.issuanceId === iss.id);
    const details = iss.stubDetails || [];
    const count = Math.max(formStubs.length, details.length);
    for (let i = 0; i < count; i++) {
      rows.push({ iss, f, isSerial, fs: formStubs[i] || null, sd: details[i] || null, i });
    }
  });

  const fundStubData = fundStub ? forms.find(f => f.id === fundStub.formId)?.stubs?.[fundStub.stubIdx] : null;
  const fundStubForm = fundStub ? forms.find(f => f.id === fundStub.formId) : null;
  const noteStubData = noteStub ? forms.find(f => f.id === noteStub.formId)?.stubs?.[noteStub.stubIdx] : null;
  const noteStubForm = noteStub ? forms.find(f => f.id === noteStub.formId) : null;

  return (
    <div className="pg active">
      <div className="card">
        <div className="card-hd"><span className="card-title">Forms Issued to Me</span></div>
        <div className="tw">
          <table>
            <thead><tr><th>Date Issued</th><th>Form</th><th>Stub</th><th>Batch</th><th>Fund</th><th>Details</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8}><div className="empty" style={{ padding: 24 }}><p>No forms have been issued to you yet.</p></div></td></tr>
              ) : rows.map((row, ri) => {
                const { iss, f, isSerial, fs, sd, i } = row;
                let stubLabel;
                if (isSerial) {
                  const code = (fs && fs.codeNo) || (sd && sd.codeNo) || `Stub ${i + 1}`;
                  const from = (fs && fs.seriesFrom) || (sd && sd.seriesFrom) || '';
                  const to = (fs && fs.seriesTo) || (sd && sd.seriesTo) || '';
                  stubLabel = <span className="mono" style={{ fontSize: 12 }}><strong>{code}</strong>{from && <> <span style={{ color: 'var(--g500)' }}>{from}–{to}</span></>}</span>;
                } else {
                  const label = (fs && fs.label) || (sd && sd.label) || `Stub ${i + 1}`;
                  const pcs = (fs && fs.pieces) || (sd && sd.pieces) || 0;
                  stubLabel = <span className="mono" style={{ fontSize: 12 }}><strong>{label}</strong> <span style={{ color: 'var(--g500)' }}>{pcs.toLocaleString()} pcs</span></span>;
                }
                let fundCell = <span style={{ fontSize: 11, color: 'var(--g400)' }}>—</span>;
                if (fs) {
                  fundCell = fs.fund
                    ? <>
                        <div className="fund-lock-box">
                          <span className="badge b-stub" style={{ fontSize: 10.5 }}>{fs.fund}</span>
                          <span className="fl-tag"><IcLock /> Locked</span>
                        </div>
                        {fs.isDivided && fs.splitFund && <div style={{ fontSize: 10.5, color: 'var(--g500)', marginTop: 2 }}>split w/ {fs.splitFund}</div>}
                      </>
                    : <span style={{ fontSize: 11, color: 'var(--g400)' }}>Not set</span>;
                }
                let statusCell;
                if (fs && fs.consumedAt) statusCell = <><span className="badge b-consumed">✓ Consumed</span><div style={{ fontSize: 11, color: 'var(--g500)', marginTop: 2 }}>{fd(fs.consumedAt)}</div></>;
                else statusCell = <span className="badge b-issued">Issued</span>;

                return (
                  <tr key={ri}>
                    <td>{fd(iss.issuedAt)}</td>
                    <td><strong>{f.name || '—'}</strong><br /><span className="mono" style={{ fontSize: 11, color: 'var(--g500)' }}>{f.code || ''}</span></td>
                    <td>{stubLabel}</td>
                    <td><span className="badge b-stub" style={{ fontSize: 10 }}>{(fs && fs.batchNo) || '—'}</span></td>
                    <td>{fundCell}</td>
                    <td style={{ maxWidth: 220, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {fs ? (fs.stubNote || <span style={{ color: 'var(--g400)' }}>—</span>) : <span style={{ color: 'var(--g400)' }}>—</span>}
                    </td>
                    <td>{statusCell}</td>
                    <td>
                      {fs ? (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          {fs.fund ? (
                            <span style={{ fontSize: 11, color: 'var(--g500)' }}>Fund locked — ask an admin to change it</span>
                          ) : (
                            <button className="btn btn-gold btn-sm" style={{ padding: '5px 10px', fontSize: 11.5 }} onClick={() => setFundStub({ formId: iss.formId, stubIdx: fs._fi })}>Select Fund</button>
                          )}
                          <button className="btn btn-outline btn-sm" style={{ padding: '5px 10px', fontSize: 11.5 }} onClick={() => setNoteStub({ formId: iss.formId, stubIdx: fs._fi })}>{fs.stubNote ? 'Edit Details' : 'Add Details'}</button>
                        </div>
                      ) : <span style={{ fontSize: 11, color: 'var(--g400)' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {fundStubData && (
        <SelectFundModal stub={fundStubData} form={fundStubForm} funds={funds} onClose={() => setFundStub(null)}
          onSave={(value, isDivided, otherValue) => saveFund(fundStub.formId, fundStub.stubIdx, value, isDivided, otherValue)} />
      )}
      {noteStubData && (
        <StubDetailsModal stub={noteStubData} form={noteStubForm} onClose={() => setNoteStub(null)}
          onSave={text => saveNote(noteStub.formId, noteStub.stubIdx, text)} />
      )}
    </div>
  );
}

const NOTE_MAX = 200;

function StubDetailsModal({ stub, form, onClose, onSave }) {
  const [text, setText] = useState(stub.stubNote || '');
  const [errMsg, setErrMsg] = useState('');

  function submit() {
    setErrMsg('');
    const e = onSave(text.trim());
    if (e) setErrMsg(e);
  }

  return (
    <Modal size="sm" title="Stub Details" onClose={onClose} footer={<>
      <button className="btn btn-outline" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={submit}>Save</button>
    </>}>
      {errMsg && <div className="emsg" style={{ display: '' }}>{errMsg}</div>}
      <div className="fg" style={{ background: 'var(--g50)', padding: '10px 12px', borderRadius: 'var(--rs)' }}>
        <label style={{ marginBottom: 0 }}>Accountable Form Stub</label>
        <div style={{ fontSize: 13.5, color: 'var(--g900)', marginTop: 3, fontWeight: 600 }}>
          {form.name} — {stub.codeNo || stub.label || stub.batchNo || ''}{stub.seriesFrom && !stub.isPiece ? ` (${stub.seriesFrom}–${stub.seriesTo})` : ''}
        </div>
      </div>
      <div className="fg">
        <label>Details</label>
        <textarea value={text} maxLength={NOTE_MAX} onChange={e => setText(e.target.value)} placeholder="e.g. Market stall fees, Jan–Mar" autoFocus />
        <div className="hint">{text.length}/{NOTE_MAX} — shown beside this stub when you file an RCD. You can change it any time.</div>
      </div>
    </Modal>
  );
}

function SelectFundModal({ stub, form, funds, onClose, onSave }) {
  const [value, setValue] = useState(stub.fund || '');
  const [divided, setDivided] = useState(!!stub.isDivided);
  const [other, setOther] = useState(stub.splitFund || '');
  const [errMsg, setErrMsg] = useState('');

  function submit() {
    setErrMsg('');
    if (!value) { setErrMsg('Select a fund.'); return; }
    if (divided) {
      if (!other) { setErrMsg('Select the other fund to divide with.'); return; }
      if (other === value) { setErrMsg('The other fund must be different from the main fund.'); return; }
    }
    const e = onSave(value, divided, other);
    if (e) setErrMsg(e);
  }

  return (
    <Modal size="sm" title="Select Fund" onClose={onClose} footer={<>
      <button className="btn btn-outline" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={submit}>Save</button>
    </>}>
      {errMsg && <div className="emsg" style={{ display: '' }}>{errMsg}</div>}
      <div className="fg" style={{ background: 'var(--g50)', padding: '10px 12px', borderRadius: 'var(--rs)' }}>
        <label style={{ marginBottom: 0 }}>Official Receipt</label>
        <div style={{ fontSize: 13.5, color: 'var(--g900)', marginTop: 3, fontWeight: 600 }}>{form.name} — {stub.codeNo || stub.batchNo || ''} ({stub.seriesFrom}–{stub.seriesTo})</div>
      </div>
      <div className="fg">
        <label>Fund <span className="req">*</span></label>
        <select value={value} onChange={e => setValue(e.target.value)}>
          <option value="">Select fund…</option>
          {funds.map(fn => <option key={fn} value={fn}>{fn}</option>)}
        </select>
      </div>
      <div className="fg" style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: 'row' }}>
        <input type="checkbox" checked={divided} onChange={e => setDivided(e.target.checked)} style={{ width: 16, height: 16, flex: 'none' }} />
        <label style={{ marginBottom: 0, fontWeight: 500 }}>This form's collection is divided with another fund</label>
      </div>
      {divided && (
        <div className="fg">
          <label>Other Fund <span className="req">*</span></label>
          <select value={other} onChange={e => setOther(e.target.value)}>
            <option value="">Select fund…</option>
            {funds.map(fn => <option key={fn} value={fn}>{fn}</option>)}
          </select>
          <div style={{ fontSize: 11.5, color: 'var(--g500)', marginTop: 4 }}>When you file an RCD for this OR, the amount will be split 50/50 between these two funds and two RCDs will be created.</div>
        </div>
      )}
    </Modal>
  );
}
