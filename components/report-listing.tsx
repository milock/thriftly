'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Flag } from 'lucide-react';
import type { ReportReason } from '@/lib/listing-reports';

const REASONS: ReportReason[] = ['wrong-location', 'donation-only', 'closed', 'duplicate', 'incorrect-hours', 'departments', 'shopper-review', 'other'];
const FIELD = 'min-h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

export function ReportListing({ storeId, storeName }: { storeId: string; storeName: string }) {
  const t = useTranslations('reports');
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('wrong-location');
  const [details, setDetails] = useState('');
  const [visitedOn, setVisitedOn] = useState('');
  const [rating, setRating] = useState('');
  const [confirmedVisit, setConfirmedVisit] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const retry = useRef<{ payload: string; requestId: string } | null>(null);
  const visitRequired = reason === 'departments' || reason === 'shopper-review';
  const detailsRequired = reason === 'departments' || reason === 'other';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'sending') return;
    const payload = JSON.stringify({ storeId, reason, details: details.trim(), visitedOn: visitedOn || null, rating: reason === 'shopper-review' && rating ? Number(rating) : null, confirmedVisit: reason === 'shopper-review' && confirmedVisit });
    setStatus('sending');
    setError('');
    try {
      // Retry the same id after a timeout: the server may already have saved it.
      if (retry.current?.payload !== payload) retry.current = { payload, requestId: crypto.randomUUID() };
      const response = await fetch('/api/reports', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...JSON.parse(payload), requestId: retry.current.requestId }),
        signal: AbortSignal.timeout(45000),
      });
      const body = await response.json().catch(() => null) as { id?: string; status?: string; error?: string } | null;
      if (response.status !== 201 || body?.status !== 'pending' || !body.id) {
        setError(response.status === 429 ? t('rateLimited') : response.status === 400 ? t('checkDetails') : t('failed'));
        setStatus('error');
        return;
      }
      setStatus('success');
    } catch {
      setError(t('failed'));
      setStatus('error');
    }
  }

  return (
    <div className="relative min-w-0 text-sm data-[open=true]:basis-full" data-report-listing data-open={open} onClick={event => event.stopPropagation()}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-form`}
        aria-label={t('buttonFor', { store: storeName })}
        className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        onClick={() => setOpen(value => !value)}
      >
        <Flag className="size-3.5" aria-hidden />
        {t('button')}
      </button>
      {open && (
        <div id={`${id}-form`} className="mt-2 rounded-lg border border-border bg-background p-3 sm:p-4">
          {status === 'success' ? (
            <p role="status" className="leading-relaxed">{t('success')}</p>
          ) : (
            <form onSubmit={submit} className="space-y-3" aria-label={t('formFor', { store: storeName })}>
              <p className="text-sm leading-relaxed text-muted-foreground">{t('intro')}</p>
              <div>
                <label htmlFor={`${id}-reason`} className="mb-1 block font-medium">{t('reason')}</label>
                <select id={`${id}-reason`} value={reason} disabled={status === 'sending'} className={FIELD} onChange={event => setReason(event.target.value as ReportReason)}>
                  {REASONS.map(value => <option key={value} value={value}>{t(`reasons.${value}`)}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor={`${id}-visited`} className="mb-1 block font-medium">{t(visitRequired ? 'visitedRequired' : 'visited')}</label>
                <input id={`${id}-visited`} type="date" value={visitedOn} min="2000-01-01" max={new Date().toISOString().slice(0, 10)} required={visitRequired} disabled={status === 'sending'} className={FIELD} onChange={event => setVisitedOn(event.target.value)} />
              </div>
              {reason === 'shopper-review' && (
                <fieldset className="space-y-3">
                  <legend className="mb-1 font-medium">{t('rating')}</legend>
                  <label htmlFor={`${id}-rating`} className="sr-only">{t('rating')}</label>
                  <select id={`${id}-rating`} value={rating} required disabled={status === 'sending'} className={FIELD} onChange={event => setRating(event.target.value)}>
                    <option value="">{t('chooseRating')}</option>
                    {[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{t('ratingOption', { value })}</option>)}
                  </select>
                  <label className="flex min-h-11 items-start gap-2 leading-relaxed">
                    <input type="checkbox" checked={confirmedVisit} required disabled={status === 'sending'} className="mt-1 size-5 shrink-0 accent-foreground" onChange={event => setConfirmedVisit(event.target.checked)} />
                    <span>{t('confirmVisit')}</span>
                  </label>
                </fieldset>
              )}
              <div>
                <label htmlFor={`${id}-details`} className="mb-1 block font-medium">{t(detailsRequired ? 'detailsRequired' : 'details')}</label>
                <textarea
                  id={`${id}-details`} rows={4} value={details} maxLength={1500} minLength={detailsRequired ? 10 : undefined} required={detailsRequired}
                  disabled={status === 'sending'} aria-describedby={`${id}-privacy`} className={`${FIELD} resize-y`}
                  placeholder={reason === 'departments' ? t('departmentsHint') : t('detailsHint')}
                  onChange={event => setDetails(event.target.value)}
                />
                <p id={`${id}-privacy`} className="mt-1 text-xs leading-relaxed text-muted-foreground">{t('privacy')}</p>
              </div>
              {status === 'error' && <p role="alert" className="text-sm leading-relaxed text-destructive">{error}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={status === 'sending'} className="min-h-11 rounded-md bg-foreground px-4 py-2 font-medium text-background disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{t(status === 'sending' ? 'sending' : 'submit')}</button>
                <button type="button" className="min-h-11 rounded-md px-4 py-2 text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={() => setOpen(false)}>{t('cancel')}</button>
              </div>
              <p className="sr-only" role="status">{status === 'sending' ? t('sending') : ''}</p>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
