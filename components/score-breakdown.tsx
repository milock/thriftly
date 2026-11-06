import {useTranslations, useLocale} from 'next-intl';
import type {GoodsScore} from '@/lib/types';
import {formatCurrency, formatPercent} from '@/lib/format';
import {hasNeighborhoodBaseline} from '@/lib/scoring';

export function ScoreBreakdown({score}: {score: GoodsScore}) {
  const t=useTranslations('ui'), l=useTranslations('listing'), locale=useLocale();
  const number=new Intl.NumberFormat(locale,{maximumFractionDigits:1,numberingSystem:locale==='ar'?'arab':'latn'});
  const visit=score.visit;
  if (!hasNeighborhoodBaseline(score)) return <p className="text-sm text-muted-foreground">{t('notScored')}</p>;
  const keys=Object.keys(score.factors) as Array<keyof GoodsScore['factors']>;
  return <div className="space-y-3">
    <p className="text-3xl font-semibold tabular-nums" data-score-total={Math.round(score.total)}>{number.format(Math.round(score.total))}<span className="text-sm font-normal text-muted-foreground"> / 100</span></p>
    {visit && <table className="w-full text-start text-xs"><thead className="text-muted-foreground"><tr><th className="pb-2 text-start font-normal">{l('component')}</th><th className="pb-2 text-end font-normal">{l('weight')}</th><th className="pb-2 text-end font-normal">{l('points')}</th></tr></thead><tbody>
      {Object.entries(visit.components).map(([key,part])=><tr key={key} className="border-t" data-score-component={key}>
        <th className="py-2 pe-2 text-start font-medium">{l(key==='neighborhood'?'neighborhoodScore':key==='walkability'?'walkability':'googleScore')}<span className="mt-0.5 block font-normal text-muted-foreground">{part.value===null?'—':key==='googleRatings'?`${number.format(part.value)}/5 · ${number.format(visit.coverage.googleRatingCount ?? 0)}`:`${number.format(part.normalized ?? 0)}/100`}</span></th>
        <td className="py-2 ps-2 text-end tabular-nums">{number.format(part.effectiveWeight*100)}%</td>
        <td className="py-2 ps-2 text-end font-medium tabular-nums" data-score-points={part.contribution ?? 0}>{part.contribution===null?'—':number.format(part.contribution)}</td>
      </tr>)}
    </tbody></table>}
    <p className="text-xs leading-relaxed text-muted-foreground">{l('roundedNote')} {l('scoreNote')}</p>
    <details className="border-t"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">{l('neighborhoodScore')}</summary>
      {keys.some(key=>score.factors[key].value===null)&&<p className="pb-2 text-xs text-muted-foreground">{l('partialCensus')}</p>}
      <dl className="space-y-2 pb-3">{keys.map(key=>{const f=score.factors[key];return <div key={key} className="flex flex-wrap justify-between gap-x-3 text-xs"><dt className="text-muted-foreground">{t(key)}</dt><dd className="tabular-nums">{f.value==null?'—':key==='pctBachelorsPlus'?formatPercent(f.value,locale):key==='medianGrossRent'?t('monthly',{amount:formatCurrency(f.value,{locale})}):formatCurrency(f.value,{locale})}</dd></div>;})}</dl>
      <p className="pb-3 text-xs text-muted-foreground">{t('tracts',{count:score.catchment.tractCount})}{score.catchment.population>0&&<> · {t('residents',{count:score.catchment.population})}</>}</p>
    </details>
    <details className="border-t"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">{t('howScoring')}</summary>
      <p className="text-xs leading-relaxed text-muted-foreground">{l('scoreMethod')}</p>
      {visit&&visit.components.walkability.value!==null&&<p className="mt-2 text-xs text-muted-foreground"><a className="underline" href="https://www.epa.gov/smartgrowth/national-walkability-index-user-guide-and-methodology" target="_blank" rel="noopener noreferrer">{l('accessVintage')}</a>. {l('historicalAccess')}</p>}
    </details>
  </div>;
}
