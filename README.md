# Industrial symbiosis in Västra Götaland

An interactive report and results summary on how waste generated in the
49 kommuner of Västra Götaland County could replace imported production
inputs. The reference year is 2022.

| | |
|---|---|
| Interactive report | <https://makijota.github.io/vg-industrial-symbiosis/> |
| Results report | [`docs/reports/`](docs/reports/) |
| Method | [`docs/method.html`](docs/method.html) |
| About | [`docs/about.html`](docs/about.html) |
| Companion Skaraborg case | <https://makijota.github.io/skaraborg-symbiosis/skaraborg/> |

The report estimates waste from workplace employment and sector waste
intensities, estimates demand from imported raw and semi-finished goods,
matches compatible waste and products using MAESTRI and reviewed W2RKG
knowledge, and allocates potential exchanges at regional, kommun, sub-region
and firm scales. The same core method is used for the Skaraborg case.

Results are model estimates, not measured exchanges or forecasts. Confidential
source microdata and research caches are not included. Firm-level results are
anonymised; mapped locations use a 1 km grid.
The Västra Götalandsregionen wordmark is from <https://www.vgregion.se/>.

## Viewing locally

Serve the `docs/` directory with a static web server, for example:

```sh
python -m http.server 8000 --directory docs
```

Then open <http://localhost:8000>.
