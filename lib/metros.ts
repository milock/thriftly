/**
 * Curated U.S. metros for the local-search landing pages (`/goodwill/[slug]`).
 *
 * These are the highest-search-volume "goodwill in <city>" markets, all with
 * strong Goodwill coverage in OpenStreetMap. Each entry feeds: a statically
 * generated, server-rendered ranked page; the sitemap; and the `/goodwill` hub.
 * Coordinates are the city center; a 15-mile radius keeps each page focused on
 * the city core rather than sprawling across the whole metro.
 */
export interface Metro {
  slug: string; // url segment, e.g. "los-angeles-ca"
  city: string; // "Los Angeles"
  state: string; // postal, "CA"
  stateName: string; // "California"
  lat: number;
  lon: number;
  radiusMiles: number;
}

export const METROS: Metro[] = [
  { slug: "new-york-ny", city: "New York", state: "NY", stateName: "New York", lat: 40.7128, lon: -74.006, radiusMiles: 15 },
  { slug: "los-angeles-ca", city: "Los Angeles", state: "CA", stateName: "California", lat: 34.0522, lon: -118.2437, radiusMiles: 15 },
  { slug: "chicago-il", city: "Chicago", state: "IL", stateName: "Illinois", lat: 41.8781, lon: -87.6298, radiusMiles: 15 },
  { slug: "houston-tx", city: "Houston", state: "TX", stateName: "Texas", lat: 29.7604, lon: -95.3698, radiusMiles: 15 },
  { slug: "phoenix-az", city: "Phoenix", state: "AZ", stateName: "Arizona", lat: 33.4484, lon: -112.074, radiusMiles: 15 },
  { slug: "philadelphia-pa", city: "Philadelphia", state: "PA", stateName: "Pennsylvania", lat: 39.9526, lon: -75.1652, radiusMiles: 15 },
  { slug: "san-antonio-tx", city: "San Antonio", state: "TX", stateName: "Texas", lat: 29.4241, lon: -98.4936, radiusMiles: 15 },
  { slug: "san-diego-ca", city: "San Diego", state: "CA", stateName: "California", lat: 32.7157, lon: -117.1611, radiusMiles: 15 },
  { slug: "dallas-tx", city: "Dallas", state: "TX", stateName: "Texas", lat: 32.7767, lon: -96.797, radiusMiles: 15 },
  { slug: "austin-tx", city: "Austin", state: "TX", stateName: "Texas", lat: 30.2672, lon: -97.7431, radiusMiles: 15 },
  { slug: "san-jose-ca", city: "San Jose", state: "CA", stateName: "California", lat: 37.3382, lon: -121.8863, radiusMiles: 15 },
  { slug: "jacksonville-fl", city: "Jacksonville", state: "FL", stateName: "Florida", lat: 30.3322, lon: -81.6557, radiusMiles: 15 },
  { slug: "columbus-oh", city: "Columbus", state: "OH", stateName: "Ohio", lat: 39.9612, lon: -82.9988, radiusMiles: 15 },
  { slug: "charlotte-nc", city: "Charlotte", state: "NC", stateName: "North Carolina", lat: 35.2271, lon: -80.8431, radiusMiles: 15 },
  { slug: "indianapolis-in", city: "Indianapolis", state: "IN", stateName: "Indiana", lat: 39.7684, lon: -86.1581, radiusMiles: 15 },
  { slug: "san-francisco-ca", city: "San Francisco", state: "CA", stateName: "California", lat: 37.7749, lon: -122.4194, radiusMiles: 15 },
  { slug: "seattle-wa", city: "Seattle", state: "WA", stateName: "Washington", lat: 47.6062, lon: -122.3321, radiusMiles: 15 },
  { slug: "denver-co", city: "Denver", state: "CO", stateName: "Colorado", lat: 39.7392, lon: -104.9903, radiusMiles: 15 },
  { slug: "nashville-tn", city: "Nashville", state: "TN", stateName: "Tennessee", lat: 36.1627, lon: -86.7816, radiusMiles: 15 },
  { slug: "portland-or", city: "Portland", state: "OR", stateName: "Oregon", lat: 45.5152, lon: -122.6784, radiusMiles: 15 },
  { slug: "las-vegas-nv", city: "Las Vegas", state: "NV", stateName: "Nevada", lat: 36.1699, lon: -115.1398, radiusMiles: 15 },
  { slug: "atlanta-ga", city: "Atlanta", state: "GA", stateName: "Georgia", lat: 33.749, lon: -84.388, radiusMiles: 15 },
  { slug: "miami-fl", city: "Miami", state: "FL", stateName: "Florida", lat: 25.7617, lon: -80.1918, radiusMiles: 15 },
  { slug: "minneapolis-mn", city: "Minneapolis", state: "MN", stateName: "Minnesota", lat: 44.9778, lon: -93.265, radiusMiles: 15 },
  { slug: "sacramento-ca", city: "Sacramento", state: "CA", stateName: "California", lat: 38.5816, lon: -121.4944, radiusMiles: 15 },
  { slug: "tampa-fl", city: "Tampa", state: "FL", stateName: "Florida", lat: 27.9506, lon: -82.4572, radiusMiles: 15 },
  { slug: "orlando-fl", city: "Orlando", state: "FL", stateName: "Florida", lat: 28.5383, lon: -81.3792, radiusMiles: 15 },
  { slug: "pittsburgh-pa", city: "Pittsburgh", state: "PA", stateName: "Pennsylvania", lat: 40.4406, lon: -79.9959, radiusMiles: 15 },
  { slug: "cincinnati-oh", city: "Cincinnati", state: "OH", stateName: "Ohio", lat: 39.1031, lon: -84.512, radiusMiles: 15 },
  { slug: "kansas-city-mo", city: "Kansas City", state: "MO", stateName: "Missouri", lat: 39.0997, lon: -94.5786, radiusMiles: 15 },
  { slug: "st-louis-mo", city: "St. Louis", state: "MO", stateName: "Missouri", lat: 38.627, lon: -90.1994, radiusMiles: 15 },
  { slug: "salt-lake-city-ut", city: "Salt Lake City", state: "UT", stateName: "Utah", lat: 40.7608, lon: -111.891, radiusMiles: 15 },
  { slug: "boston-ma", city: "Boston", state: "MA", stateName: "Massachusetts", lat: 42.3601, lon: -71.0589, radiusMiles: 15 },
  { slug: "washington-dc", city: "Washington", state: "DC", stateName: "District of Columbia", lat: 38.9072, lon: -77.0369, radiusMiles: 15 },
  { slug: "detroit-mi", city: "Detroit", state: "MI", stateName: "Michigan", lat: 42.3314, lon: -83.0458, radiusMiles: 15 },
  { slug: "raleigh-nc", city: "Raleigh", state: "NC", stateName: "North Carolina", lat: 35.7796, lon: -78.6382, radiusMiles: 15 },
];

export function getMetro(slug: string): Metro | undefined {
  return METROS.find((m) => m.slug === slug);
}
