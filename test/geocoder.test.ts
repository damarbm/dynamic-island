import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
    buildLocationSearchUrl,
    parseLocationSearchResults,
} from '../src/prayer/geocoder.ts';

test('builds an explicit Indonesia-only location search', () => {
    const url = buildLocationSearchUrl('Cibinong, Bogor, Jawa Barat');
    assert.ok(url);
    const parsed = new URL(url);
    assert.equal(parsed.hostname, 'nominatim.openstreetmap.org');
    assert.equal(parsed.searchParams.get('countrycodes'), 'id');
    assert.equal(parsed.searchParams.get('limit'), '5');
    assert.match(parsed.searchParams.get('q') ?? '', /Indonesia$/);
    assert.equal(buildLocationSearchUrl('  '), null);
});

test('parses valid Indonesian results and rejects malformed or foreign rows', () => {
    const results = parseLocationSearchResults(JSON.stringify([
        {
            display_name: 'Cibinong, Bogor, Jawa Barat, Indonesia',
            lat: '-6.4850',
            lon: '106.8420',
            address: {country_code: 'id'},
        },
        {
            display_name: 'Foreign result',
            lat: '1',
            lon: '2',
            address: {country_code: 'sg'},
        },
        {
            display_name: 'Invalid coordinate',
            lat: '999',
            lon: '2',
            address: {country_code: 'id'},
        },
    ]));
    assert.deepEqual(results, [{
        label: 'Cibinong, Bogor, Jawa Barat, Indonesia',
        latitude: -6.485,
        longitude: 106.842,
    }]);
    assert.deepEqual(parseLocationSearchResults('not json'), []);
});
