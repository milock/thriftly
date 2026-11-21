import Link from 'next/link';
import {HydrationMarker} from '@/components/hydration-marker';
export default function GlobalNotFound(){return <html lang="en"><body><main><h1>Page not found</h1><p><Link href="/">Thriftly</Link></p></main><HydrationMarker/></body></html>;}
