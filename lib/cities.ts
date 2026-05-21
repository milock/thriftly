/**
 * The national location hierarchy for the local-SEO pages:
 *   /goodwill                  -> hub, lists every state
 *   /goodwill/state/[state]    -> lists that state's cities
 *   /goodwill/[citySlug]       -> ranked Goodwills for the city
 *
 * Source of truth is `BY_STATE` (city names only). Coordinates are resolved by
 * the precompute job (`scripts/build-city-data.mjs`) via the Census geocoder and
 * stored in `data/cities/<slug>.json`, so we don't hand-maintain ~450 lat/lons.
 * Slugs are `<city>-<state>` (lowercased), which keeps the original metro URLs
 * (e.g. `san-diego-ca`) stable.
 */
export interface City {
  slug: string;
  city: string;
  state: string; // postal code
  stateName: string;
  radiusMiles: number;
}

export interface StateEntry {
  code: string;
  name: string;
  slug: string;
}

const BY_STATE: Record<string, { name: string; cities: string[] }> = {
  AL: { name: "Alabama", cities: ["Birmingham", "Montgomery", "Huntsville", "Mobile", "Tuscaloosa", "Hoover", "Auburn", "Dothan", "Decatur"] },
  AK: { name: "Alaska", cities: ["Anchorage", "Fairbanks", "Juneau", "Wasilla", "Kenai", "Kodiak"] },
  AZ: { name: "Arizona", cities: ["Phoenix", "Tucson", "Mesa", "Chandler", "Scottsdale", "Glendale", "Gilbert", "Tempe", "Peoria", "Surprise"] },
  AR: { name: "Arkansas", cities: ["Little Rock", "Fort Smith", "Fayetteville", "Springdale", "Jonesboro", "Rogers", "Conway", "North Little Rock", "Bentonville"] },
  CA: { name: "California", cities: ["Los Angeles", "San Diego", "San Jose", "San Francisco", "Sacramento", "Fresno", "Long Beach", "Oakland", "Bakersfield", "Anaheim"] },
  CO: { name: "Colorado", cities: ["Denver", "Colorado Springs", "Aurora", "Fort Collins", "Lakewood", "Thornton", "Pueblo", "Boulder", "Greeley"] },
  CT: { name: "Connecticut", cities: ["Bridgeport", "New Haven", "Hartford", "Stamford", "Waterbury", "Norwalk", "Danbury", "New Britain"] },
  DE: { name: "Delaware", cities: ["Wilmington", "Dover", "Newark", "Middletown", "Smyrna"] },
  FL: { name: "Florida", cities: ["Jacksonville", "Miami", "Tampa", "Orlando", "St. Petersburg", "Hialeah", "Tallahassee", "Fort Lauderdale", "Cape Coral", "Port St. Lucie"] },
  GA: { name: "Georgia", cities: ["Atlanta", "Augusta", "Columbus", "Macon", "Savannah", "Athens", "Sandy Springs", "Roswell", "Albany"] },
  HI: { name: "Hawaii", cities: ["Honolulu", "Hilo", "Kailua", "Kapolei", "Pearl City", "Waipahu"] },
  ID: { name: "Idaho", cities: ["Boise", "Meridian", "Nampa", "Idaho Falls", "Caldwell", "Pocatello", "Coeur d'Alene", "Twin Falls"] },
  IL: { name: "Illinois", cities: ["Chicago", "Aurora", "Naperville", "Joliet", "Rockford", "Springfield", "Peoria", "Elgin", "Champaign"] },
  IN: { name: "Indiana", cities: ["Indianapolis", "Fort Wayne", "Evansville", "South Bend", "Carmel", "Fishers", "Bloomington", "Hammond", "Gary"] },
  IA: { name: "Iowa", cities: ["Des Moines", "Cedar Rapids", "Davenport", "Sioux City", "Iowa City", "Waterloo", "Ames", "Council Bluffs"] },
  KS: { name: "Kansas", cities: ["Wichita", "Overland Park", "Kansas City", "Olathe", "Topeka", "Lawrence", "Shawnee", "Manhattan"] },
  KY: { name: "Kentucky", cities: ["Louisville", "Lexington", "Bowling Green", "Owensboro", "Covington", "Richmond", "Florence", "Elizabethtown"] },
  LA: { name: "Louisiana", cities: ["New Orleans", "Baton Rouge", "Shreveport", "Lafayette", "Lake Charles", "Kenner", "Bossier City", "Monroe"] },
  ME: { name: "Maine", cities: ["Portland", "Lewiston", "Bangor", "South Portland", "Auburn", "Biddeford", "Augusta"] },
  MD: { name: "Maryland", cities: ["Baltimore", "Columbia", "Germantown", "Silver Spring", "Frederick", "Rockville", "Gaithersburg", "Annapolis"] },
  MA: { name: "Massachusetts", cities: ["Boston", "Worcester", "Springfield", "Cambridge", "Lowell", "Brockton", "Quincy", "Lynn", "Newton"] },
  MI: { name: "Michigan", cities: ["Detroit", "Grand Rapids", "Warren", "Sterling Heights", "Ann Arbor", "Lansing", "Flint", "Dearborn", "Livonia"] },
  MN: { name: "Minnesota", cities: ["Minneapolis", "Saint Paul", "Rochester", "Duluth", "Bloomington", "Brooklyn Park", "Plymouth", "Saint Cloud"] },
  MS: { name: "Mississippi", cities: ["Jackson", "Gulfport", "Southaven", "Hattiesburg", "Biloxi", "Meridian", "Tupelo", "Olive Branch"] },
  MO: { name: "Missouri", cities: ["Kansas City", "St. Louis", "Springfield", "Columbia", "Independence", "Lee's Summit", "O'Fallon", "St. Joseph"] },
  MT: { name: "Montana", cities: ["Billings", "Missoula", "Great Falls", "Bozeman", "Butte", "Helena", "Kalispell"] },
  NE: { name: "Nebraska", cities: ["Omaha", "Lincoln", "Bellevue", "Grand Island", "Kearney", "Fremont", "Hastings"] },
  NV: { name: "Nevada", cities: ["Las Vegas", "Henderson", "Reno", "North Las Vegas", "Sparks", "Carson City", "Elko"] },
  NH: { name: "New Hampshire", cities: ["Manchester", "Nashua", "Concord", "Derry", "Dover", "Rochester", "Salem"] },
  NJ: { name: "New Jersey", cities: ["Newark", "Jersey City", "Paterson", "Elizabeth", "Trenton", "Camden", "Clifton", "Edison"] },
  NM: { name: "New Mexico", cities: ["Albuquerque", "Las Cruces", "Rio Rancho", "Santa Fe", "Roswell", "Farmington", "Clovis"] },
  NY: { name: "New York", cities: ["New York", "Buffalo", "Rochester", "Yonkers", "Syracuse", "Albany", "New Rochelle", "Mount Vernon", "Schenectady"] },
  NC: { name: "North Carolina", cities: ["Charlotte", "Raleigh", "Greensboro", "Durham", "Winston-Salem", "Fayetteville", "Cary", "Wilmington", "High Point"] },
  ND: { name: "North Dakota", cities: ["Fargo", "Bismarck", "Grand Forks", "Minot", "West Fargo", "Williston", "Dickinson"] },
  OH: { name: "Ohio", cities: ["Columbus", "Cleveland", "Cincinnati", "Toledo", "Akron", "Dayton", "Parma", "Canton", "Youngstown"] },
  OK: { name: "Oklahoma", cities: ["Oklahoma City", "Tulsa", "Norman", "Broken Arrow", "Edmond", "Lawton", "Moore", "Stillwater"] },
  OR: { name: "Oregon", cities: ["Portland", "Salem", "Eugene", "Gresham", "Hillsboro", "Beaverton", "Bend", "Medford"] },
  PA: { name: "Pennsylvania", cities: ["Philadelphia", "Pittsburgh", "Allentown", "Erie", "Reading", "Scranton", "Bethlehem", "Lancaster", "Harrisburg"] },
  RI: { name: "Rhode Island", cities: ["Providence", "Warwick", "Cranston", "Pawtucket", "East Providence", "Woonsocket", "Newport"] },
  SC: { name: "South Carolina", cities: ["Columbia", "Charleston", "North Charleston", "Mount Pleasant", "Rock Hill", "Greenville", "Summerville", "Spartanburg"] },
  SD: { name: "South Dakota", cities: ["Sioux Falls", "Rapid City", "Aberdeen", "Brookings", "Watertown", "Mitchell"] },
  TN: { name: "Tennessee", cities: ["Nashville", "Memphis", "Knoxville", "Chattanooga", "Clarksville", "Murfreesboro", "Franklin", "Johnson City"] },
  TX: { name: "Texas", cities: ["Houston", "San Antonio", "Dallas", "Austin", "Fort Worth", "El Paso", "Arlington", "Corpus Christi", "Plano", "Lubbock"] },
  UT: { name: "Utah", cities: ["Salt Lake City", "West Valley City", "Provo", "West Jordan", "Orem", "Sandy", "Ogden", "St. George", "Layton"] },
  VT: { name: "Vermont", cities: ["Burlington", "South Burlington", "Rutland", "Essex", "Colchester", "Montpelier"] },
  VA: { name: "Virginia", cities: ["Virginia Beach", "Norfolk", "Chesapeake", "Richmond", "Arlington", "Newport News", "Alexandria", "Roanoke"] },
  WA: { name: "Washington", cities: ["Seattle", "Spokane", "Tacoma", "Vancouver", "Bellevue", "Kent", "Everett", "Renton", "Yakima"] },
  WV: { name: "West Virginia", cities: ["Charleston", "Huntington", "Morgantown", "Parkersburg", "Wheeling", "Martinsburg"] },
  WI: { name: "Wisconsin", cities: ["Milwaukee", "Madison", "Green Bay", "Kenosha", "Racine", "Appleton", "Waukesha", "Oshkosh", "Eau Claire"] },
  WY: { name: "Wyoming", cities: ["Cheyenne", "Casper", "Laramie", "Gillette", "Rock Springs", "Sheridan"] },
  DC: { name: "District of Columbia", cities: ["Washington"] },
};

function kebab(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const STATES: StateEntry[] = Object.entries(BY_STATE).map(([code, { name }]) => ({
  code,
  name,
  slug: kebab(name),
}));

export const CITIES: City[] = Object.entries(BY_STATE).flatMap(([code, { name, cities }]) =>
  cities.map((city) => ({
    slug: `${kebab(city)}-${code.toLowerCase()}`,
    city,
    state: code,
    stateName: name,
    radiusMiles: 15,
  })),
);

export function getCity(slug: string): City | undefined {
  return CITIES.find((c) => c.slug === slug);
}

export function getState(slug: string): StateEntry | undefined {
  return STATES.find((s) => s.slug === slug);
}

export function citiesInState(code: string): City[] {
  return CITIES.filter((c) => c.state === code);
}
