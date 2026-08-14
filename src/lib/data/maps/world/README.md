# World Map Regional Topologies

This directory contains optimized regional topology files extracted from the full world topology (`countries-50m.json`, 98.8KB).

Regional groupings follow the Pew Research Center **Countries and Regions Guide (May 2026)** using Broadest2019, Broad2019, and Sub2019 columns.

These regional files include **only the arcs (borders) needed** for the countries in each region, resulting in significant file size reductions.

## Files

- **countries-50m.json** (98.8KB) - Full world map with all countries
- **countries-locator.json** (~416KB) - Low-res full-world topology for small orthographic locator globes (`map.globe.topology: 'locator'`). Broader country coverage than 50m (includes island nations). Source: author-supplied `low_res.json.gz`, normalized so each geometry has ISO-numeric `id` and `properties.name`. Kosovo is remapped from Natural Earth `-99` → `412`. French overseas territories that the source labels with sovereign France `250` are remapped to their territory codes so region membership stays correct: French Guiana `254`, Guadeloupe `312`, Martinique `474`, Réunion `638`. Disputed/non-ISO features are dropped.

### africa-50m.json (20.8KB, 78.9% reduction)
**Region:** Africa (Broad2019)
**Countries:** 49
**Arcs:** 154 of 592

<details>
<summary>View country list</summary>

- Algeria
- Angola
- Benin
- Botswana
- Burkina Faso
- Burundi
- Cameroon
- Central African Republic
- Chad
- Congo, Democratic Republic
- Congo, Republic
- Djibouti
- Equatorial Guinea
- Eritrea
- Eswatini
- Ethiopia
- Gabon
- Gambia
- Ghana
- Guinea
- Guinea-Bissau
- Ivory Coast
- Kenya
- Lesotho
- Liberia
- Libya
- Madagascar
- Malawi
- Mali
- Mauritania
- Morocco
- Mozambique
- Namibia
- Niger
- Nigeria
- Rwanda
- Senegal
- Sierra Leone
- Somalia
- South Africa
- South Sudan
- Sudan
- Tanzania
- Togo
- Tunisia
- Uganda
- Western Sahara
- Zambia
- Zimbabwe

</details>

### americas-50m.json (29.2KB, 70.4% reduction)
**Region:** Americas (Broadest2019)
**Countries:** 31
**Arcs:** 130 of 592

<details>
<summary>View country list</summary>

- Argentina
- Bahamas
- Belize
- Bolivia
- Brazil
- Canada
- Chile
- Colombia
- Costa Rica
- Cuba
- Dominican Republic
- Ecuador
- El Salvador
- Falkland Islands
- Greenland
- Guatemala
- Guyana
- Haiti
- Honduras
- Jamaica
- Mexico
- Nicaragua
- Panama
- Paraguay
- Peru
- Puerto Rico
- Suriname
- Trinidad and Tobago
- United States
- Uruguay
- Venezuela

</details>

### asia-50m.json (24.7KB, 75.0% reduction)
**Region:** Asia (Broadest2019)
**Countries:** 36
**Arcs:** 135 of 592

<details>
<summary>View country list</summary>

- Afghanistan
- Australia
- Azerbaijan
- Bangladesh
- Bhutan
- Brunei
- Cambodia
- China
- East Timor
- Fiji
- India
- Indonesia
- Japan
- Kazakhstan
- Kyrgyzstan
- Laos
- Malaysia
- Mongolia
- Myanmar
- Nepal
- New Caledonia
- New Zealand
- North Korea
- Pakistan
- Papua New Guinea
- Philippines
- Solomon Islands
- South Korea
- Sri Lanka
- Taiwan
- Tajikistan
- Thailand
- Turkmenistan
- Uzbekistan
- Vanuatu
- Vietnam

</details>

### asia-pacific-50m.json (24.7KB, 75.0% reduction)
**Region:** Asia-Pacific (Broad2019)
**Countries:** 36
**Arcs:** 135 of 592

<details>
<summary>View country list</summary>

- Afghanistan
- Australia
- Azerbaijan
- Bangladesh
- Bhutan
- Brunei
- Cambodia
- China
- East Timor
- Fiji
- India
- Indonesia
- Japan
- Kazakhstan
- Kyrgyzstan
- Laos
- Malaysia
- Mongolia
- Myanmar
- Nepal
- New Caledonia
- New Zealand
- North Korea
- Pakistan
- Papua New Guinea
- Philippines
- Solomon Islands
- South Korea
- Sri Lanka
- Taiwan
- Tajikistan
- Thailand
- Turkmenistan
- Uzbekistan
- Vanuatu
- Vietnam

</details>

### caribbean-50m.json (2.2KB, 97.8% reduction)
**Region:** Caribbean (Sub2019)
**Countries:** 7
**Arcs:** 10 of 592

<details>
<summary>View country list</summary>

- Bahamas
- Cuba
- Dominican Republic
- Haiti
- Jamaica
- Puerto Rico
- Trinidad and Tobago

</details>

### central-america-50m.json (5.8KB, 94.1% reduction)
**Region:** Central America (Sub2019)
**Countries:** 8
**Arcs:** 31 of 592

<details>
<summary>View country list</summary>

- Belize
- Costa Rica
- El Salvador
- Guatemala
- Honduras
- Mexico
- Nicaragua
- Panama

</details>

### central-asia-50m.json (7.6KB, 92.3% reduction)
**Region:** Central Asia (Sub2019)
**Countries:** 6
**Arcs:** 53 of 592

<details>
<summary>View country list</summary>

- Azerbaijan
- Kazakhstan
- Kyrgyzstan
- Tajikistan
- Turkmenistan
- Uzbekistan

</details>

### continent-africa-50m.json (21.2KB, 78.5% reduction)
**Region:** Africa (Continent) (Continent)
**Countries:** 50
**Arcs:** 160 of 592

<details>
<summary>View country list</summary>

- Algeria
- Angola
- Benin
- Botswana
- Burkina Faso
- Burundi
- Cameroon
- Central African Republic
- Chad
- Congo, Democratic Republic
- Congo, Republic
- Djibouti
- Egypt
- Equatorial Guinea
- Eritrea
- Eswatini
- Ethiopia
- Gabon
- Gambia
- Ghana
- Guinea
- Guinea-Bissau
- Ivory Coast
- Kenya
- Lesotho
- Liberia
- Libya
- Madagascar
- Malawi
- Mali
- Mauritania
- Morocco
- Mozambique
- Namibia
- Niger
- Nigeria
- Rwanda
- Senegal
- Sierra Leone
- Somalia
- South Africa
- South Sudan
- Sudan
- Tanzania
- Togo
- Tunisia
- Uganda
- Western Sahara
- Zambia
- Zimbabwe

</details>

### continent-asia-50m.json (26.4KB, 73.3% reduction)
**Region:** Asia (Continent) (Continent)
**Countries:** 46
**Arcs:** 178 of 592

<details>
<summary>View country list</summary>

- Afghanistan
- Armenia
- Azerbaijan
- Bangladesh
- Bhutan
- Brunei
- Cambodia
- China
- Cyprus
- East Timor
- Georgia
- India
- Indonesia
- Iran
- Iraq
- Israel
- Japan
- Jordan
- Kazakhstan
- Kuwait
- Kyrgyzstan
- Laos
- Lebanon
- Malaysia
- Mongolia
- Myanmar
- Nepal
- North Korea
- Oman
- Pakistan
- Palestinian territories
- Philippines
- Qatar
- Saudi Arabia
- South Korea
- Sri Lanka
- Syria
- Taiwan
- Tajikistan
- Thailand
- Turkey
- Turkmenistan
- United Arab Emirates
- Uzbekistan
- Vietnam
- Yemen

</details>

### continent-europe-50m.json (28.4KB, 71.2% reduction)
**Region:** Europe (Continent) (Continent)
**Countries:** 39
**Arcs:** 201 of 592

<details>
<summary>View country list</summary>

- Albania
- Austria
- Belarus
- Belgium
- Bosnia and Herzegovina
- Bulgaria
- Croatia
- Czech Republic
- Denmark
- Estonia
- Finland
- France
- Germany
- Greece
- Hungary
- Iceland
- Ireland
- Italy
- Kosovo
- Latvia
- Lithuania
- Luxembourg
- Moldova
- Montenegro
- Netherlands
- North Macedonia
- Norway
- Poland
- Portugal
- Romania
- Russia
- Serbia
- Slovakia
- Slovenia
- Spain
- Sweden
- Switzerland
- Ukraine
- United Kingdom

</details>

### continent-north-america-50m.json (21.5KB, 78.2% reduction)
**Region:** North America (Continent) (Continent)
**Countries:** 18
**Arcs:** 86 of 592

<details>
<summary>View country list</summary>

- Bahamas
- Belize
- Canada
- Costa Rica
- Cuba
- Dominican Republic
- El Salvador
- Greenland
- Guatemala
- Haiti
- Honduras
- Jamaica
- Mexico
- Nicaragua
- Panama
- Puerto Rico
- Trinidad and Tobago
- United States

</details>

### continent-oceania-50m.json (8.4KB, 91.5% reduction)
**Region:** Oceania (Continent) (Continent)
**Countries:** 7
**Arcs:** 35 of 592

<details>
<summary>View country list</summary>

- Australia
- Fiji
- New Caledonia
- New Zealand
- Papua New Guinea
- Solomon Islands
- Vanuatu

</details>

### continent-south-america-50m.json (9.4KB, 90.5% reduction)
**Region:** South America (Continent) (Continent)
**Countries:** 13
**Arcs:** 54 of 592

<details>
<summary>View country list</summary>

- Argentina
- Bolivia
- Brazil
- Chile
- Colombia
- Ecuador
- Falkland Islands
- Guyana
- Paraguay
- Peru
- Suriname
- Uruguay
- Venezuela

</details>

### east-asia-50m.json (17.0KB, 82.8% reduction)
**Region:** East Asia (Sub2019)
**Countries:** 17
**Arcs:** 99 of 592

<details>
<summary>View country list</summary>

- Brunei
- Cambodia
- China
- East Timor
- Indonesia
- Japan
- Laos
- Malaysia
- Mongolia
- Myanmar
- North Korea
- Papua New Guinea
- Philippines
- South Korea
- Taiwan
- Thailand
- Vietnam

</details>

### eastern-europe-50m.json (22.3KB, 77.4% reduction)
**Region:** Eastern Europe (Sub2019)
**Countries:** 23
**Arcs:** 170 of 592

<details>
<summary>View country list</summary>

- Albania
- Armenia
- Belarus
- Bosnia and Herzegovina
- Bulgaria
- Croatia
- Czech Republic
- Estonia
- Georgia
- Hungary
- Kosovo
- Latvia
- Lithuania
- Moldova
- Montenegro
- North Macedonia
- Poland
- Romania
- Russia
- Serbia
- Slovakia
- Slovenia
- Ukraine

</details>

### europe-50m.json (29.6KB, 70.0% reduction)
**Region:** Europe (Broadest2019)
**Countries:** 42
**Arcs:** 210 of 592

<details>
<summary>View country list</summary>

- Albania
- Armenia
- Austria
- Belarus
- Belgium
- Bosnia and Herzegovina
- Bulgaria
- Croatia
- Cyprus
- Czech Republic
- Denmark
- Estonia
- Finland
- France
- Georgia
- Germany
- Greece
- Hungary
- Iceland
- Ireland
- Italy
- Kosovo
- Latvia
- Lithuania
- Luxembourg
- Moldova
- Montenegro
- Netherlands
- North Macedonia
- Norway
- Poland
- Portugal
- Romania
- Russia
- Serbia
- Slovakia
- Slovenia
- Spain
- Sweden
- Switzerland
- Ukraine
- United Kingdom

</details>

### latin-america-and-the-caribbean-50m.json (15.5KB, 84.3% reduction)
**Region:** Latin America and the Caribbean (Broad2019)
**Countries:** 28
**Arcs:** 85 of 592

<details>
<summary>View country list</summary>

- Argentina
- Bahamas
- Belize
- Bolivia
- Brazil
- Chile
- Colombia
- Costa Rica
- Cuba
- Dominican Republic
- Ecuador
- El Salvador
- Falkland Islands
- Guatemala
- Guyana
- Haiti
- Honduras
- Jamaica
- Mexico
- Nicaragua
- Panama
- Paraguay
- Peru
- Puerto Rico
- Suriname
- Trinidad and Tobago
- Uruguay
- Venezuela

</details>

### middle-east-50m.json (10.7KB, 89.2% reduction)
**Region:** Middle East (Broad2019)
**Countries:** 15
**Arcs:** 99 of 592

<details>
<summary>View country list</summary>

- Egypt
- Iran
- Iraq
- Israel
- Jordan
- Kuwait
- Lebanon
- Oman
- Palestinian territories
- Qatar
- Saudi Arabia
- Syria
- Turkey
- United Arab Emirates
- Yemen

</details>

### middle-east-north-africa-50m.json (16.5KB, 83.3% reduction)
**Region:** Middle East-North Africa (Broadest2019)
**Countries:** 21
**Arcs:** 146 of 592

<details>
<summary>View country list</summary>

- Algeria
- Egypt
- Iran
- Iraq
- Israel
- Jordan
- Kuwait
- Lebanon
- Libya
- Morocco
- Oman
- Palestinian territories
- Qatar
- Saudi Arabia
- Sudan
- Syria
- Tunisia
- Turkey
- United Arab Emirates
- Western Sahara
- Yemen

</details>

### north-africa-50m.json (7.9KB, 92.0% reduction)
**Region:** North Africa (Sub2019)
**Countries:** 6
**Arcs:** 64 of 592

<details>
<summary>View country list</summary>

- Algeria
- Libya
- Morocco
- Sudan
- Tunisia
- Western Sahara

</details>

### north-america-50m.json (15.7KB, 84.1% reduction)
**Region:** North America (Broad2019)
**Countries:** 3
**Arcs:** 50 of 592

<details>
<summary>View country list</summary>

- Canada
- Greenland
- United States

</details>

### oceania-50m.json (4.8KB, 95.1% reduction)
**Region:** Oceania (Sub2019)
**Countries:** 6
**Arcs:** 15 of 592

<details>
<summary>View country list</summary>

- Australia
- Fiji
- New Caledonia
- New Zealand
- Solomon Islands
- Vanuatu

</details>

### south-america-50m.json (9.4KB, 90.5% reduction)
**Region:** South America (Sub2019)
**Countries:** 13
**Arcs:** 54 of 592

<details>
<summary>View country list</summary>

- Argentina
- Bolivia
- Brazil
- Chile
- Colombia
- Ecuador
- Falkland Islands
- Guyana
- Paraguay
- Peru
- Suriname
- Uruguay
- Venezuela

</details>

### south-asia-50m.json (8.2KB, 91.7% reduction)
**Region:** South Asia (Sub2019)
**Countries:** 7
**Arcs:** 53 of 592

<details>
<summary>View country list</summary>

- Afghanistan
- Bangladesh
- Bhutan
- India
- Nepal
- Pakistan
- Sri Lanka

</details>

### sub-saharan-africa-50m.json (19.4KB, 80.4% reduction)
**Region:** Sub-Saharan Africa (Broadest2019)
**Countries:** 43
**Arcs:** 149 of 592

<details>
<summary>View country list</summary>

- Angola
- Benin
- Botswana
- Burkina Faso
- Burundi
- Cameroon
- Central African Republic
- Chad
- Congo, Democratic Republic
- Congo, Republic
- Djibouti
- Equatorial Guinea
- Eritrea
- Eswatini
- Ethiopia
- Gabon
- Gambia
- Ghana
- Guinea
- Guinea-Bissau
- Ivory Coast
- Kenya
- Lesotho
- Liberia
- Madagascar
- Malawi
- Mali
- Mauritania
- Mozambique
- Namibia
- Niger
- Nigeria
- Rwanda
- Senegal
- Sierra Leone
- Somalia
- South Africa
- South Sudan
- Tanzania
- Togo
- Uganda
- Zambia
- Zimbabwe

</details>

### western-europe-50m.json (13.7KB, 86.1% reduction)
**Region:** Western Europe (Sub2019)
**Countries:** 19
**Arcs:** 114 of 592

<details>
<summary>View country list</summary>

- Austria
- Belgium
- Cyprus
- Denmark
- Finland
- France
- Germany
- Greece
- Iceland
- Ireland
- Italy
- Luxembourg
- Netherlands
- Norway
- Portugal
- Spain
- Sweden
- Switzerland
- United Kingdom

</details>


## Regenerating Files

```bash
node create-world-topology.js
node create-optimized-regional-topologies.js
```

## Non-standard ISO Codes

| Territory | ID | Alpha-3 | Notes |
| --------- | -- | ------- | ----- |
| Kosovo | 383 | XKX | User-assigned code (widely used) |
| Western Sahara | 732 | ESH | Contested territory per Pew guide |

## Technical Details

TopoJSON stores geographic boundaries as shared "arcs". The optimization process identifies which arcs are needed for the selected countries and removes all others.
