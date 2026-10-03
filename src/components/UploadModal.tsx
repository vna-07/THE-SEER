'use client';

import { useEffect, useState } from 'react';
import ScanAnimation from './ScanAnimation';
import { Icon } from './Icon';

type Tab = 'upload' | 'manual';
type Stage = 'input' | 'scan' | 'preview';

type EProduct = { name: string; quantity: string; unit: string; price: string };
type ESale = { date: string; item: string; quantity: string; unitPrice: string; total: string };
type EExpense = { date: string; description: string; amount: string };
type EReceivable = { customerName: string; amount: string; dueDate: string };

export default function UploadModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('upload');
  const [stage, setStage] = useState<Stage>('input');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocrSnippet, setOcrSnippet] = useState<string | null>(null);

  const [scanImage, setScanImage] = useState<string | null>(null);
  const [scanOcrText, setScanOcrText] = useState<string | null>(null);
  const [pendingExtract, setPendingExtract] = useState<any>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [recordDate, setRecordDate] = useState(today);

  const [products, setProducts] = useState<EProduct[]>([
    { name: '', quantity: '', unit: '', price: '' },
  ]);
  const [sales, setSales] = useState<ESale[]>([]);
  const [expenses, setExpenses] = useState<EExpense[]>([]);
  const [receivables, setReceivables] = useState<EReceivable[]>([
    { customerName: '', amount: '', dueDate: '' },
  ]);

  // Advance to preview the moment extraction lands.
  useEffect(() => {
    if (stage === 'scan' && pendingExtract) {
      populateFromExtraction(pendingExtract);
      setStage('preview');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, pendingExtract]);

  async function handleExtract(file: File) {
    setBusy(true);
    setError(null);
    setMessage(null);
    setOcrSnippet(null);
    setPendingExtract(null);

    const reader = new FileReader();
    reader.onload = () => {
      setScanImage(String(reader.result));
      setScanOcrText(null);
      setStage('scan');
    };
    reader.readAsDataURL(file);

    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch('/api/extract', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'extraction failed');
      setScanOcrText(data.ocrSnippet ?? null);
      setPendingExtract(data);
    } catch (err: any) {
      setError(String(err?.message ?? err));
      setStage('input');
    } finally {
      setBusy(false);
    }
  }

  function populateFromExtraction(data: any) {
    const p: EProduct[] = (data.products ?? []).map((x: any) => ({
      name: String(x.name ?? ''),
      quantity: String(x.quantity ?? ''),
      unit: String(x.unit ?? ''),
      price: x.price != null ? String(x.price) : '',
    }));
    const s: ESale[] = (data.sales ?? []).map((x: any) => ({
      date: String(x.date ?? ''),
      item: String(x.item ?? ''),
      quantity: String(x.quantity ?? ''),
      unitPrice: x.unitPrice != null ? String(x.unitPrice) : '',
      total: x.total != null ? String(x.total) : '',
    }));
    const e: EExpense[] = (data.expenses ?? []).map((x: any) => ({
      date: String(x.date ?? ''),
      description: String(x.description ?? ''),
      amount: String(x.amount ?? ''),
    }));
    const r: EReceivable[] = (data.receivables ?? []).map((x: any) => ({
      customerName: String(x.customerName ?? ''),
      amount: String(x.amount ?? ''),
      dueDate: String(x.dueDate ?? ''),
    }));

    setProducts(p.length ? p : [{ name: '', quantity: '', unit: '', price: '' }]);
    setSales(s);
    setExpenses(e);
    setReceivables(r.length ? r : [{ customerName: '', amount: '', dueDate: '' }]);
    setOcrSnippet(data.ocrSnippet ?? '');
  }

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    setMessage(null);

    const cleanProducts = products
      .filter((p) => p.name.trim())
      .map((p) => ({
        name: p.name,
        quantity: Number(p.quantity) || 0,
        unit: p.unit || undefined,
        price: p.price !== '' ? Number(p.price) : undefined,
      }));

    const cleanSales = sales
      .filter((s) => s.item.trim())
      .map((s) => ({
        date: s.date || undefined,
        item: s.item,
        quantity: Number(s.quantity) || 0,
        unitPrice: s.unitPrice !== '' ? Number(s.unitPrice) : undefined,
        total: s.total !== '' ? Number(s.total) : undefined,
      }));

    const cleanExpenses = expenses
      .filter((e) => e.description.trim())
      .map((e) => ({
        date: e.date || undefined,
        description: e.description,
        amount: Number(e.amount) || 0,
      }));

    const cleanReceivables = receivables
      .filter((r) => r.customerName.trim())
      .map((r) => ({
        customerName: r.customerName,
        amount: Number(r.amount) || 0,
        dueDate: r.dueDate || undefined,
      }));

    if (
      !cleanProducts.length &&
      !cleanSales.length &&
      !cleanExpenses.length &&
      !cleanReceivables.length
    ) {
      setError('Nothing to save. Add at least one row.');
      setBusy(false);
      return;
    }

    try {
      const res = await fetch('/api/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordDate,
          products: cleanProducts,
          sales: cleanSales,
          expenses: cleanExpenses,
          receivables: cleanReceivables,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'save failed');

      setMessage(
        `Saved ${data.productsAdded} products, ${data.salesAdded ?? 0} sales, ${data.expensesAdded ?? 0} expenses, ${data.receivablesAdded} receivables. ${data.risksQueued} risks recalculated.`
      );
      setProducts([{ name: '', quantity: '', unit: '', price: '' }]);
      setSales([]);
      setExpenses([]);
      setReceivables([{ customerName: '', amount: '', dueDate: '' }]);
      setStage('input');
      setScanImage(null);
      setScanOcrText(null);
      setPendingExtract(null);
      setOcrSnippet(null);
    } catch (err: any) {
      setError(String(err?.message ?? err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass"
        style={{
          background: 'rgba(31, 28, 25, 0.97)',
          borderRadius: '2rem',
          padding: '1.5rem',
          maxWidth: 900,
          width: '100%',
          maxHeight: '94vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div className="label" style={{ color: 'var(--accent)' }}>
              {stage === 'scan' ? 'Scanning page' : stage === 'preview' ? 'Review & correct' : 'Add data'}
            </div>
            <h3 style={{ margin: '0.15rem 0 0', fontSize: '1.15rem', fontWeight: 800 }}>
              {stage === 'scan'
                ? 'Reading your ledger…'
                : stage === 'preview'
                ? 'Confirm extracted data'
                : 'Upload a page or enter manually'}
            </h3>
          </div>
          <button onClick={onClose} style={{ fontSize: '1.2rem', color: 'var(--fg-muted)' }}>
            <Icon name="x" size={18} />
          </button>
        </div>

        {stage === 'input' && (
          <div
            className="glass"
            style={{
              borderRadius: '1.5rem',
              padding: '0.4rem',
              display: 'inline-flex',
              gap: '0.25rem',
              alignSelf: 'flex-start',
            }}
          >
            {(['upload', 'manual'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '0.4rem 0.9rem',
                  borderRadius: '1rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: tab === t ? 'var(--accent)' : 'transparent',
                  color: tab === t ? 'var(--bg)' : 'var(--fg-muted)',
                }}
              >
                <Icon name={t === 'upload' ? 'camera' : 'file'} size={13} />
                {t === 'upload' ? 'Upload photo / PDF' : 'Manual entry'}
              </button>
            ))}
          </div>
        )}

        <div>
          <label
            className="small"
            style={{ fontWeight: 700, display: 'block', marginBottom: '0.3rem' }}
          >
            What date is this record from?
          </label>
          <input
            type="date"
            value={recordDate}
            onChange={(e) => setRecordDate(e.target.value)}
            disabled={stage !== 'input'}
            style={{
              width: '100%',
              padding: '0.6rem 0.8rem',
              borderRadius: '0.75rem',
              border: '1px solid var(--border-hair)',
              background: stage !== 'input' ? 'rgba(240,240,238,0.1)' : 'rgba(255,255,255,0.06)',
              color: 'var(--fg)',
              font: 'inherit',
            }}
          />
        </div>

        {stage === 'input' && tab === 'upload' && (
          <label
            style={{
              display: 'block',
              padding: '2.5rem',
              border: '2px dashed rgba(242, 196, 107, 0.3)',
              borderRadius: '1rem',
              textAlign: 'center',
              cursor: busy ? 'not-allowed' : 'pointer',
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            <div style={{ color: 'var(--accent)', marginBottom: '0.6rem' }}>
              <Icon name="file" size={32} strokeWidth={1.2} />
            </div>
            <div className="small" style={{ fontWeight: 700 }}>
              {busy ? 'Reading…' : 'Click to choose a photo or PDF'}
            </div>
            <div className="tiny muted" style={{ marginTop: '0.3rem' }}>
              JPEG, PNG, WebP, PDF · multi-page supported
            </div>
            <input
              type="file"
              accept="image/*,application/pdf"
              style={{ display: 'none' }}
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleExtract(f);
              }}
            />
          </label>
        )}

        {stage === 'scan' && scanImage && (
          <ScanAnimation
            imageUrl={scanImage}
            ocrText={scanOcrText}
            stillLoading={!pendingExtract}
            durationMs={3500}
          />
        )}

        {stage === 'preview' && ocrSnippet && (
          <details>
            <summary className="small muted" style={{ cursor: 'pointer', fontWeight: 700 }}>
              Show raw OCR text
            </summary>
            <pre
              className="mono"
              style={{
                marginTop: '0.5rem',
                background: '#0B2A1F',
                color: 'var(--accent-lime)',
                padding: '0.8rem',
                borderRadius: '0.9rem',
                fontSize: '0.7rem',
                maxHeight: 200,
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
              }}
            >
              {ocrSnippet}
            </pre>
          </details>
        )}

        {(stage === 'preview' || (stage === 'input' && tab === 'manual')) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <Section title="Stock on hand" count={products.filter((p) => p.name.trim()).length}>
              {products.map((p, i) => (
                <GridRow
                  key={i}
                  cols="2fr 1fr 1fr 1fr auto"
                  onRemove={() => setProducts(products.filter((_, j) => j !== i))}
                >
                  <Input placeholder="Item name" value={p.name} onChange={(v) => upd(products, setProducts, i, 'name', v)} />
                  <Input placeholder="Qty" value={p.quantity} onChange={(v) => upd(products, setProducts, i, 'quantity', v)} />
                  <Input placeholder="Unit" value={p.unit} onChange={(v) => upd(products, setProducts, i, 'unit', v)} />
                  <Input placeholder="Price" value={p.price} onChange={(v) => upd(products, setProducts, i, 'price', v)} />
                </GridRow>
              ))}
              <AddBtn onClick={() => setProducts([...products, { name: '', quantity: '', unit: '', price: '' }])}>
                Add product
              </AddBtn>
            </Section>

            <Section title="Sales" count={sales.length}>
              {sales.map((s, i) => (
                <GridRow
                  key={i}
                  cols="1fr 2fr 1fr 1fr 1fr auto"
                  onRemove={() => setSales(sales.filter((_, j) => j !== i))}
                >
                  <Input placeholder="Date" value={s.date} onChange={(v) => upd(sales, setSales, i, 'date', v)} />
                  <Input placeholder="Item" value={s.item} onChange={(v) => upd(sales, setSales, i, 'item', v)} />
                  <Input placeholder="Qty" value={s.quantity} onChange={(v) => upd(sales, setSales, i, 'quantity', v)} />
                  <Input placeholder="Unit R" value={s.unitPrice} onChange={(v) => upd(sales, setSales, i, 'unitPrice', v)} />
                  <Input placeholder="Total" value={s.total} onChange={(v) => upd(sales, setSales, i, 'total', v)} />
                </GridRow>
              ))}
              <AddBtn onClick={() => setSales([...sales, { date: '', item: '', quantity: '', unitPrice: '', total: '' }])}>
                Add sale
              </AddBtn>
            </Section>

            <Section title="Expenses" count={expenses.length}>
              {expenses.map((e, i) => (
                <GridRow
                  key={i}
                  cols="1fr 3fr 1fr auto"
                  onRemove={() => setExpenses(expenses.filter((_, j) => j !== i))}
                >
                  <Input placeholder="Date" value={e.date} onChange={(v) => upd(expenses, setExpenses, i, 'date', v)} />
                  <Input placeholder="Description" value={e.description} onChange={(v) => upd(expenses, setExpenses, i, 'description', v)} />
                  <Input placeholder="Amount R" value={e.amount} onChange={(v) => upd(expenses, setExpenses, i, 'amount', v)} />
                </GridRow>
              ))}
              <AddBtn onClick={() => setExpenses([...expenses, { date: '', description: '', amount: '' }])}>
                Add expense
              </AddBtn>
            </Section>

            <Section title="Customers owed" count={receivables.filter((r) => r.customerName.trim()).length}>
              {receivables.map((r, i) => (
                <GridRow
                  key={i}
                  cols="2fr 1fr 1fr auto"
                  onRemove={() => setReceivables(receivables.filter((_, j) => j !== i))}
                >
                  <Input placeholder="Customer" value={r.customerName} onChange={(v) => upd(receivables, setReceivables, i, 'customerName', v)} />
                  <Input placeholder="Amount R" value={r.amount} onChange={(v) => upd(receivables, setReceivables, i, 'amount', v)} />
                  <Input type="date" value={r.dueDate} onChange={(v) => upd(receivables, setReceivables, i, 'dueDate', v)} />
                </GridRow>
              ))}
              <AddBtn onClick={() => setReceivables([...receivables, { customerName: '', amount: '', dueDate: '' }])}>
                Add customer
              </AddBtn>
            </Section>
          </div>
        )}

        {message && (
          <div className="small" style={{ background: 'var(--accent-soft-green)', color: 'var(--accent-emerald)', padding: '0.7rem 0.9rem', borderRadius: '0.9rem', fontWeight: 600 }}>
            ✓ {message}
          </div>
        )}
        {error && (
          <div className="small" style={{ background: '#FEE2E2', color: 'var(--critical)', padding: '0.7rem 0.9rem', borderRadius: '0.9rem', fontWeight: 600 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          {stage === 'preview' && (
            <button
              className="btn-ghost"
              onClick={() => {
                setStage('input');
                setOcrSnippet(null);
                setPendingExtract(null);
                setScanImage(null);
              }}
              disabled={busy}
              style={{ padding: '0.75rem 1rem' }}
            >
              ← Back
            </button>
          )}
          <button className="btn-ghost" onClick={onClose} disabled={busy} style={{ padding: '0.75rem 1rem' }}>
            Close
          </button>
          {(stage === 'preview' || (stage === 'input' && tab === 'manual')) && (
            <button
              className="btn-primary"
              onClick={handleConfirm}
              disabled={busy}
              style={{ width: 'auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}
            >
              {busy ? 'Saving…' : 'Confirm & save'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', marginBottom: '0.5rem' }}>
        <span className="small" style={{ fontWeight: 800 }}>
          {title}
        </span>
        <span className="badge">{count}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>{children}</div>
    </div>
  );
}

function GridRow({ children, cols, onRemove }: { children: React.ReactNode; cols: string; onRemove: () => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '0.4rem', alignItems: 'center' }}>
      {children}
      <button onClick={onRemove} style={{ color: 'var(--critical)', fontSize: '1rem', padding: '0 0.6rem' }}>
        ✕
      </button>
    </div>
  );
}

function AddBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button className="btn-ghost" onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
      <Icon name="plus" size={13} />
      {children}
    </button>
  );
}

function Input({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '0.5rem 0.7rem',
        borderRadius: '0.6rem',
        border: '1px solid var(--border-hair)',
        background: 'rgba(255,255,255,0.06)',
        color: 'var(--fg)',
        font: 'inherit',
        fontSize: '0.8rem',
      }}
    />
  );
}

function upd<T extends object>(arr: T[], setArr: (a: T[]) => void, i: number, key: keyof T, value: string) {
  const next = arr.slice();
  next[i] = { ...next[i], [key]: value };
  setArr(next);
}