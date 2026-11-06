import {afterEach, describe, expect, it, vi} from 'vitest';
import {LiveStoreSession, withLiveDetails} from '@/lib/live-store-session';
import type {LiveGoogleDetails, ScoredStore} from '@/lib/types';
import {computeGoodsScore} from '@/lib/scoring';
import {computeVisitScore} from '@/lib/visit-score';
const google: LiveGoogleDetails={placeId:'confirmed-place',name:'Google shop',address:'1 Main St',location:{lat:1,lon:1},businessStatus:'OPERATIONAL',currentOpeningHours:null,regularOpeningHours:null,phone:null,website:null,rating:4.5,ratingCount:50,mapsUrl:null,attributions:[]};
afterEach(()=>vi.useRealTimers());
describe('active-page Google session',()=>{
 it('hydrates server ratings without another request and refreshes them explicitly',async()=>{
  vi.useFakeTimers();const fetcher=vi.fn().mockResolvedValue({...google,rating:4.8});
  const session=new LiveStoreSession(fetcher,4,[{id:'a',google}]);
  expect(session.getServerSnapshot().get('a')?.google?.rating).toBe(4.5);
  session.setStores(['a']);session.request('a');expect(fetcher).not.toHaveBeenCalled();
  session.reset();session.setStores(['a']);session.request('a');
  await vi.advanceTimersByTimeAsync(100);expect(fetcher).toHaveBeenCalledTimes(1);
  expect(session.getSnapshot().get('a')?.google?.rating).toBe(4.8);session.dispose();
 });
 it('expires queued rows five seconds after enqueue, even before a request slot opens',async()=>{
  vi.useFakeTimers();const fetcher=vi.fn(()=>new Promise<LiveGoogleDetails>(()=>{}));
  const session=new LiveStoreSession(fetcher,1);session.setStores(['a','b']);
  session.request('a');session.request('b');await vi.advanceTimersByTimeAsync(5100);
  expect(session.getSnapshot().get('a')?.status).toBe('unavailable');
  expect(session.getSnapshot().get('b')?.status).toBe('unavailable');session.dispose();
 });
 it('deduplicates in-flight and loaded requests through view switches',async()=>{
  vi.useFakeTimers(); let resolve!:(g:LiveGoogleDetails)=>void;
  const fetcher=vi.fn(()=>new Promise<LiveGoogleDetails>(r=>{resolve=r}));
  const session=new LiveStoreSession(fetcher);session.setStores(['one']);
  session.request('one');session.request('one');expect(fetcher).toHaveBeenCalledTimes(1);
  resolve(google);await vi.advanceTimersByTimeAsync(100);
  expect(session.getSnapshot().get('one')?.status).toBe('loaded');
  session.request('one');session.setStores(['one']);session.request('one');expect(fetcher).toHaveBeenCalledTimes(1);
  session.dispose();
 });
 it('bounds concurrency, prioritizes visible rows, and cancels obsolete searches',async()=>{
  vi.useFakeTimers();const calls:string[]=[];const finish=new Map<string,(g:LiveGoogleDetails)=>void>();const signals=new Map<string,AbortSignal>();
  const session=new LiveStoreSession((id,signal)=>{calls.push(id);signals.set(id,signal);return new Promise(r=>finish.set(id,r));},1);
  session.setStores(['a','b','c']);session.request('a',1);session.request('b',2);session.request('c',0);
  expect(calls).toEqual(['a']);finish.get('a')!(google);await vi.advanceTimersByTimeAsync(0);expect(calls).toEqual(['a','c']);
  session.setStores(['b']);expect(signals.get('c')?.aborted).toBe(true);session.request('b');
  await vi.advanceTimersByTimeAsync(100);expect(calls).toEqual(['a','c','b']);expect(session.getSnapshot().has('a')).toBe(false);
  session.dispose();
 });
 it('stops waiting at five seconds and permits an explicit retry',async()=>{
  vi.useFakeTimers();const fetcher=vi.fn<()=>Promise<LiveGoogleDetails>>().mockImplementationOnce(()=>new Promise(()=>{})).mockResolvedValue(google);
  const session=new LiveStoreSession(fetcher);session.setStores(['a']);session.request('a');
  await vi.advanceTimersByTimeAsync(5100);expect(session.getSnapshot().get('a')?.status).toBe('unavailable');
  session.request('a');expect(fetcher).toHaveBeenCalledTimes(1);session.request('a',0,true);
  await vi.advanceTimersByTimeAsync(100);expect(session.getSnapshot().get('a')?.status).toBe('loaded');session.dispose();
 });
 it('reconciles blended score without mutating independent coordinates or baseline',()=>{
  const score=computeGoodsScore({medianHomeValue:500000,medianHouseholdIncome:100000,medianGrossRent:1800,pctBachelorsPlus:50,tractCount:4,population:1000});
  const visit=computeVisitScore({neighborhood:score.total,googleRatings:null,walkability:10});
  const store:ScoredStore={id:'a',name:'Source shop',googlePlaceId:google.placeId,location:{lat:1.00001,lon:1.00001},distanceMiles:1,score:{...score,baselineTotal:score.total,visit,total:visit.total!}};
  const live=withLiveDetails(store,google);
  expect(live.score.total).toBeCloseTo(.7*score.total+.25*87.5+.05*(9/19*100));
  expect(live.score.total).toBe(live.score.visit?.total);expect(store.location).toEqual({lat:1.00001,lon:1.00001});
  expect(withLiveDetails(store,{...google,location:{lat:2,lon:2}}).score.visit?.total).toBeNull();
  expect(withLiveDetails(store,{...google,placeId:'other'})).toBe(store);
  expect(withLiveDetails({...store,score:{...store.score,catchment:{tractCount:0,population:0}}},google).score.visit?.total).toBeNull();
 });
});
