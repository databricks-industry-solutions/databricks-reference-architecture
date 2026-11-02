import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import (
    app, biz, cons_rail, dashboard, data_out, fed_group, flow, genie, ing_rail,
    medallion, tile, top_band, uc,
)


def ppl2(business_tiles, tech_tiles):
    return [
        {"box": "Business", "ic": "zbrief", "tiles": business_tiles[:5]},
        {"box": "Technical", "ic": "code", "tiles": tech_tiles[:3]},
    ]


INDUSTRIES_BATCH_RENEWABLES = {
    "renewables": {
        "label": "Renewables & Cleantech",
        "blurb": "Utility-scale solar, wind and storage developers and IPPs: asset performance and SCADA, energy trading and PPAs, grid interconnection, O&M and field service, ESG and carbon.",
        "medallion": medallion(
            "Raw asset & market feeds",
            "SCADA and PPC time-series from the PI historian, turbine and inverter telemetry, revenue-meter reads, ISO market prices and dispatch signals, Maximo work orders and weather forecasts, landed exactly as received so a curtailment or a generation figure can always be replayed as it stood.",
            "Conformed asset, meter, PPA",
            "Turbines, inverters, sites and meters resolved into single conformed entities across SCADA, asset management and metering, with plant hierarchy, availability states and PPA and offtake contracts reconciled to one asset register.",
            "Availability, PR, settlement",
            "Contracted products operations, commercial and finance teams run on: availability and performance ratio by site and asset, production against P50 and P90, PPA settlement and imbalance, and ESG, carbon and REC positions.",
        ),
        "rails": {
            "src": [
                {
                    "box": "SCADA & Historian",
                    "ic": "iot",
                    "tiles": [
                        tile(
                            "AVEVA PI System",
                            "iot",
                            "The operational historian of record: high-frequency SCADA and PPC time-series from every turbine, inverter and plant controller, the source of availability and performance signals.",
                            "pi",
                            cat="Process / Time-Series Historian",
                            what="Stores high-frequency SCADA and plant-controller time-series from every turbine, inverter and site controller as the operational system of record for availability and performance.",
                            users="Performance engineers, reliability engineers and production analysts.",
                            data_out=data_out(
                                batch=flow(["structured"], "20-100 GB/day tag history", "Hourly / daily aggregates"),
                                stream=flow(["semi-structured"], "50-500k tags/sec at peak", "Continuous (sub-second sampling)")),
                        ),
                        tile(
                            "GE Vernova SCADA",
                            "iot",
                            "Wind turbine SCADA and controls from the OEM: nacelle, drivetrain and pitch telemetry, alarms and availability states against each unit.",
                            "ge-vernova",
                            cat="Turbine SCADA / OEM Control System",
                            what="OEM wind-turbine SCADA and controls emitting nacelle, drivetrain and pitch telemetry, alarms and availability states for each unit.",
                            users="Reliability engineers, performance engineers and O&M teams.",
                            data_out=data_out(
                                stream=flow(["semi-structured"], "10-100k signals/sec", "Continuous (sub-second)")),
                        ),
                        tile(
                            "Power Factors APM",
                            "gauge",
                            "Renewable asset performance management: production, availability and loss accounting across mixed-OEM solar, wind and storage fleets.",
                            "powerfactors",
                            cat="Asset Performance Management (APM)",
                            what="Renewable asset performance management aggregating production, availability and loss accounting across mixed-OEM solar, wind and storage fleets.",
                            users="Performance engineers, production analysts and asset managers.",
                            data_out=data_out(
                                batch=flow(["structured"], "1-5 GB/day", "Hourly / daily performance rollups")),
                        ),
                        tile(
                            "Huawei FusionSolar",
                            "iot",
                            "String-level inverter and PV plant monitoring: DC and AC yield, string faults and soiling signals feeding solar performance analysis.",
                            "fusionsolar",
                            cat="Solar Inverter Monitoring Platform",
                            what="String-level inverter and PV plant monitoring emitting DC/AC yield, string faults and soiling signals for solar performance analysis.",
                            users="Solar performance engineers and O&M technicians.",
                            data_out=data_out(
                                batch=flow(["structured"], "1-5 GB/day", "15-minute / hourly yield reads"),
                                stream=flow(["semi-structured"], "1-10k readings/sec", "Continuous inverter telemetry")),
                        ),
                    ],
                },
                {
                    "box": "Trading & Markets",
                    "ic": "market",
                    "tiles": [
                        tile(
                            "ERCOT / CAISO",
                            "market",
                            "ISO and RTO market participation: nodal prices, dispatch instructions and settlement, the systems bids, schedules and imbalance settle against.",
                            ["ercot", "caiso"],
                            cat="ISO/RTO Market Operator",
                            what="ISO and RTO market participation feeds: nodal prices, dispatch instructions and settlement that bids, schedules and imbalance are cleared against.",
                            users="Power traders, battery schedulers and grid compliance teams.",
                            data_out=data_out(
                                batch=flow(["structured"], "1-5 GB/day price + settlement", "Settlement cycles daily"),
                                stream=flow(["semi-structured"], "100s-1000s of signals/sec", "Continuous (5-minute dispatch)")),
                        ),
                        tile(
                            "ION Commodities ETRM",
                            "erp",
                            "Energy trading and risk management for power and PPA positions: deal capture, position, mark-to-market and settlement across the trading book.",
                            "ion",
                            cat="Energy Trading & Risk Management (ETRM)",
                            what="Captures power and PPA deals, positions, mark-to-market and settlement across the trading book.",
                            users="Power traders, PPA originators and risk/middle office.",
                            data_out=data_out(
                                batch=flow(["structured"], "1-5 GB/day deals + positions", "Intraday + end-of-day marks")),
                        ),
                        tile(
                            "Molecule ETRM",
                            "market",
                            "Cloud ETRM for power and renewables portfolios where lighter-weight position, PnL and risk reporting is the incumbent.",
                            "molecule",
                            cat="Energy Trading & Risk Management (ETRM)",
                            what="Cloud ETRM providing position, PnL and risk reporting for power and renewables portfolios where a lighter-weight incumbent is in place.",
                            users="Power traders, portfolio managers and risk teams.",
                            data_out=data_out(
                                batch=flow(["structured"], "0.5-2 GB/day", "Intraday + end-of-day")),
                        ),
                        tile(
                            "ICE Power Markets",
                            "market",
                            "Forward power, gas and carbon curves and exchange-traded prices, the market reference PPA valuation and hedging are marked against.",
                            "ice",
                            cat="Commodity Exchange & Price Reference",
                            what="Forward power, gas and carbon curves and exchange-traded prices used as the market reference for PPA valuation and hedging.",
                            users="Traders, PPA origination and risk teams.",
                            data_out=data_out(
                                batch=flow(["structured"], "MBs-GBs reference curves", "Daily settlement + intraday")),
                        ),
                    ],
                },
                {
                    "box": "O&M & Field Service",
                    "ic": "erp",
                    "tiles": [
                        tile(
                            "IBM Maximo EAM",
                            "erp",
                            "Enterprise asset management: work orders, component lifing, spares and preventive maintenance schedules against every turbine and inverter.",
                            "maximo",
                            cat="Enterprise Asset Management (EAM)",
                            what="Manages work orders, component lifing, spares and preventive-maintenance schedules against every turbine and inverter.",
                            users="O&M managers, reliability engineers and spares & logistics teams.",
                            data_out=data_out(
                                batch=flow(["structured"], "1-4 GB/day", "Nightly batch + intraday work orders")),
                        ),
                        tile(
                            "SAP Asset Mgmt",
                            "erp",
                            "Plant maintenance and enterprise asset management where SAP is the incumbent core, feeding the same work-order and asset-register entities.",
                            "sap-eam",
                            cat="Enterprise Asset Management (EAM)",
                            what="Plant maintenance and enterprise asset management on the incumbent SAP core, feeding the same work-order and asset-register entities.",
                            users="Maintenance planning, asset management and Finance.",
                            data_out=data_out(
                                batch=flow(["structured"], "1-5 GB/day", "Nightly batch")),
                        ),
                        tile(
                            "Salesforce Field Svc",
                            "crm",
                            "Field service dispatch and scheduling: technician assignment, site visits and mobile job completion for O&M crews.",
                            "salesforce-fs",
                            cat="Field Service Management (FSM)",
                            what="Field service dispatch and scheduling: technician assignment, site visits and mobile job completion for O&M crews.",
                            users="O&M dispatch, field technicians and service coordinators.",
                            data_out=data_out(
                                batch=flow(["structured"], "0.5-2 GB/day", "Hourly sync"),
                                stream=flow(["semi-structured"], "tens of events/sec", "Continuous CDC")),
                        ),
                        tile(
                            "ServiceMax",
                            "product",
                            "Asset-centric field service for renewable O&M: warranty, entitlement and technician workflow tied to the installed base.",
                            "servicemax",
                            cat="Field Service Management (FSM)",
                            what="Asset-centric field service for renewable O&M covering warranty, entitlement and technician workflow tied to the installed base.",
                            users="O&M managers, warranty administrators and field technicians.",
                            data_out=data_out(
                                batch=flow(["structured"], "0.5-2 GB/day", "Hourly / nightly sync")),
                        ),
                    ],
                },
                {
                    "box": "Grid & Metering",
                    "ic": "network",
                    "tiles": [
                        tile(
                            "Revenue Meters / MDM",
                            "db",
                            "Certified revenue-grade meter reads and the meter data management estate, the billed basis for generation, export and settlement.",
                            cat="Revenue Metering / MDM",
                            what="Certified revenue-grade meter reads and the meter data management estate, the billed basis for generation, export and settlement.",
                            users="Settlement analysts, commercial operations and finance.",
                            data_out=data_out(
                                batch=flow(["structured"], "1-5 GB/day interval reads", "Interval reads (5-15 min) + daily settle")),
                        ),
                        tile(
                            "ISO Interconnection",
                            "network",
                            "Interconnection queue, agreements and grid-code compliance data from the ISO, the constraints a project is energised and dispatched under.",
                            "ferc",
                            cat="Grid Interconnection Registry",
                            what="Interconnection queue, agreements and grid-code compliance data from the ISO defining the constraints a project is energised and dispatched under.",
                            users="Interconnection engineers, grid compliance and development teams.",
                            data_out=data_out(
                                batch=flow(["structured", "semi-structured"], "MBs-GBs documents + status", "Periodic (milestone-driven)")),
                        ),
                        tile(
                            "Itron MDM",
                            "db",
                            "Meter data management and grid-edge metering where Itron is the incumbent, feeding interval reads into settlement and loss analysis.",
                            "itron",
                            cat="AMI Meter Data Management (MDMS)",
                            what="Meter data management and grid-edge metering on the incumbent Itron estate, feeding interval reads into settlement and loss analysis.",
                            users="Settlement analysts, metering operations and commercial teams.",
                            data_out=data_out(
                                batch=flow(["structured"], "1-10 GB/day interval reads", "Hourly / daily reads")),
                        ),
                    ],
                },
                {
                    "box": "ESG & Certificates",
                    "ic": "gavel",
                    "tiles": [
                        tile(
                            "REC Registries",
                            "gavel",
                            "Renewable energy certificate and guarantee-of-origin registries (M-RETS and equivalents): issuance, transfer and retirement against metered generation.",
                            "mrets",
                            cat="Environmental Certificate Registry",
                            what="Renewable energy certificate and guarantee-of-origin registries tracking issuance, transfer and retirement against metered generation.",
                            users="ESG and sustainability teams, commercial and finance.",
                            data_out=data_out(
                                batch=flow(["structured"], "MBs-GBs certificates", "Monthly issuance + transfers")),
                        ),
                        tile(
                            "Watershed Carbon",
                            "globe",
                            "Carbon and emissions accounting: avoided-emissions, Scope reporting and audited ESG disclosure built from metered production.",
                            "watershed",
                            cat="Carbon & ESG Accounting Platform",
                            what="Carbon and emissions accounting for avoided-emissions, Scope reporting and audited ESG disclosure built from metered production.",
                            users="Chief Sustainability Office, ESG reporting and finance teams.",
                            data_out=data_out(
                                batch=flow(["structured", "semi-structured"], "MBs-GBs emissions data", "Monthly / quarterly reporting")),
                        ),
                    ],
                },
                fed_group(
                    "Project Finance",
                    "Project-finance models, asset ledgers and tax-equity and debt marts left where they are and queried in place under Unity Catalog, which avoids a second copy of the audited returns.",
                    cat="Enterprise Data Warehouse",
                    what="Project-finance models, asset ledgers and tax-equity and debt marts kept in the incumbent finance warehouse and queried in place through federation rather than copied.",
                    users="CFO & treasury, project finance and portfolio analysts.",
                    data_out=data_out(
                        batch=flow(["structured"], "TB-scale historical marts", "Queried on demand (federated)")),
                ),
            ],
            "ing": ing_rail(
                [
                    tile(
                        "Weather & Irradiance",
                        "globe",
                        "Irradiance, wind-speed and power forecasts from the meteorological provider, the exogenous driver every generation forecast is conditioned on.",
                        "solcast",
                        cat="Weather & Irradiance Provider",
                        what="Irradiance, wind-speed and power forecasts from the meteorological provider, the exogenous driver every generation forecast is conditioned on.",
                        users="Forecasting ML, performance engineers and traders.",
                        data_out=data_out(
                            batch=flow(["structured", "semi-structured"], "GBs/day gridded forecasts", "Multiple forecast cycles daily")),
                    ),
                    tile(
                        "ISO Dispatch Signals",
                        "stream",
                        "Real-time dispatch, AGC and curtailment instructions from the ISO, streamed in so the plant controller and traders react at grid latency.",
                        "caiso",
                        cat="ISO Dispatch & Curtailment Feed",
                        what="Real-time dispatch, AGC and curtailment instructions from the ISO, streamed in so the plant controller and traders react at grid latency.",
                        users="Plant controls, grid compliance and battery schedulers.",
                        data_out=data_out(
                            stream=flow(["semi-structured"], "100s-1000s of signals/sec", "Continuous (4-second AGC / dispatch)")),
                    ),
                    tile(
                        "Plant Sensor Stream",
                        "stream",
                        "High-frequency turbine, inverter and battery telemetry landed as structured events over Zerobus and existing Kafka topics for real-time performance analytics.",
                        cat="Streaming Telemetry Bus",
                        what="High-frequency turbine, inverter and battery telemetry landed as events over Zerobus and existing Kafka topics for real-time performance analytics.",
                        users="Performance engineers, forecasting ML and reliability teams.",
                        data_out=data_out(
                            stream=flow(["semi-structured"], "50-500k events/sec at peak", "Continuous (sub-second)")),
                    ),
                ]
            ),
            "ppl": ppl2(
                [
                    biz(
                        "Executive Office",
                        "Genie One",
                        "The CEO on portfolio returns and the build-out pipeline; the CFO and treasury on project finance, tax equity and the cost of capital; the Chief Sustainability Officer on carbon, RECs and the disclosure the board signs.",
                        [
                            ["Genie One", "Ask what a portfolio's availability or PPA settlement was last month without booking analyst time."],
                            ["AI/BI", "Portfolio returns, availability and carbon on one certified set of Metric Views."],
                            ["Unity Catalog", "Certification and the business glossary, so \"availability\" and \"avoided emissions\" mean one thing across the fleet."],
                        ],
                        sub=[
                            ["CEO", "portfolio returns and the development pipeline."],
                            ["CFO & Treasury", "project finance, tax equity and cost of capital."],
                            ["Chief Sustainability", "carbon, RECs and audited ESG disclosure."],
                        ],
                        ucs=["Portfolio & Finance", "ESG & Carbon", "Generation Forecasting"],
                    ),
                    biz(
                        "Asset Ops",
                        "AI/BI",
                        "Asset performance engineers on availability, performance ratio and loss accounting; reliability engineers on component health across the fleet; performance analysts closing the gap to the P50 production case.",
                        [
                            ["APM Control Room", "Availability, PR and underperformance by site and asset before the morning call."],
                            ["AI/BI", "Loss accounting and production-to-plan on the same definitions finance reads."],
                            ["Model Serving", "Underperformance and anomaly models scored against live SCADA."],
                        ],
                        sub=[
                            ["Performance Engineers", "availability, performance ratio and loss accounting."],
                            ["Reliability Engineers", "component health and failure modes across the fleet."],
                            ["Production Analysts", "the gap to the P50 case, site by site."],
                        ],
                        ucs=["Fleet Performance", "Predictive Maintenance", "Generation Forecasting"],
                    ),
                    biz(
                        "Energy Trading",
                        "Model Serving",
                        "Power traders scheduling and hedging generation into the ISO; PPA originators structuring offtake and shape risk; battery schedulers arbitraging price and ancillary markets.",
                        [
                            ["Trading & Dispatch", "Position, forecast and imbalance risk on a portfolio before a bid is placed."],
                            ["Model Serving", "Price and generation forecasts scored inside the bidding path."],
                            ["Lakehouse//RT", "Live price, dispatch and telemetry at the latency a battery cycles at."],
                        ],
                        sub=[
                            ["Power Traders", "scheduling and hedging generation into the ISO."],
                            ["PPA Origination", "offtake structure, shape and imbalance risk."],
                            ["Battery Schedulers", "price and ancillary-market arbitrage."],
                        ],
                        ucs=["Energy Trading & PPA", "Storage Optimisation", "Curtailment & Dispatch", "Generation Forecasting"],
                    ),
                    biz(
                        "O&M & Field",
                        "Lakeflow",
                        "O&M managers on truck-roll cost and mean-time-to-repair; field technicians on the work order in front of them; spares and logistics on the parts that keep the fleet turning.",
                        [
                            ["O&M Work Planner", "Predicted failures turned into scheduled work orders against the tail of assets."],
                            ["Lakeflow", "SCADA, EAM and field feeds conformed for maintenance analytics."],
                            ["MLflow", "Remaining-useful-life models tracked for audit and reproduction."],
                        ],
                        sub=[
                            ["O&M Managers", "truck-roll cost and mean-time-to-repair."],
                            ["Field Technicians", "the scheduled and corrective work order at the site."],
                            ["Spares & Logistics", "component availability and warranty recovery."],
                        ],
                        ucs=["Predictive Maintenance", "O&M & Field Service", "Fleet Performance"],
                    ),
                    biz(
                        "Grid Ops",
                        "Lakehouse//RT",
                        "Interconnection engineers on queue position and grid-code compliance; grid compliance on curtailment reporting and settlement; plant controls on PPC setpoints and dispatch response.",
                        [
                            ["Lakehouse//RT", "Live dispatch, curtailment and telemetry at grid latency."],
                            ["AI/BI", "Curtailment, availability-to-grid and compliance on certified views."],
                            ["Model Serving", "Curtailment and setpoint recommendations scored against live signals."],
                        ],
                        sub=[
                            ["Interconnection Eng", "queue position and grid-code compliance."],
                            ["Grid Compliance", "curtailment reporting and settlement accuracy."],
                            ["Plant Controls", "PPC setpoints and dispatch response."],
                        ],
                        ucs=["Grid Interconnection", "Curtailment & Dispatch", "Storage Optimisation"],
                    ),
                ],
                [
                    biz(
                        "SCADA Data Eng",
                        "Lakeflow",
                        "Land the PI historian, GE and Huawei SCADA, Maximo and revenue-meter feeds; own the Bronze to Silver path and the pager when a performance table stalls before the morning call.",
                        [
                            ["Lakeflow Connect", "Managed connectors for the historian, EAM and metering sources."],
                            ["Lakeflow Designer", "Declarative pipelines with expectations on SCADA and meter feeds."],
                            ["Lakewatch", "Freshness on the availability and production tables ops reads each morning."],
                        ],
                    ),
                    biz(
                        "Forecast ML",
                        "MLflow",
                        "Generation, price and remaining-useful-life models built from SCADA, weather and market history; whether they still hold as turbines age and price regimes shift.",
                        [
                            ["Feature Store", "Weather, telemetry and market features read identically in training and serving."],
                            ["MLflow", "Every forecast and RUL model tracked for audit and reproduction."],
                            ["Model Serving", "Generation, price and failure models scored in the operational path."],
                        ],
                    ),
                    biz(
                        "Controls & Apps",
                        "Apps",
                        "Ship the APM control room, trading desk and O&M planner the fleet works in, and write PPC setpoints and work orders back to the systems of record next to governed data.",
                        [
                            ["Apps", "Operational screens with no separate web tier to run or secure."],
                            ["Lakebase", "Serverless Postgres for dispatch decisions and work-order writes."],
                            ["Agent Bricks", "Agents that draft a work order or a curtailment note against governed tools."],
                        ],
                    ),
                ],
            ),
            "cons": cons_rail(
                [
                    {
                        "box": "BI & Productivity",
                        "ic": "chart",
                        "from": "bi",
                        "tiles": [
                            tile(
                                "Tableau / Power BI",
                                "chart",
                                "Operations, commercial and finance dashboards against serverless SQL with Unity Catalog permissions enforced end to end.",
                            ),
                            tile(
                                "Microsoft Teams",
                                "chat",
                                "Genie in Teams for governed answers on availability, curtailment and settlement in the channel the fleet already works in (Beta).",
                            ),
                            tile(
                                "Notebooks & IDEs",
                                "notebook",
                                "Performance and data-science notebooks and IDEs against governed SCADA, weather and market data.",
                            ),
                        ],
                    },
                    {
                        "box": "Grid & Market Ops",
                        "ic": "partner",
                        "tiles": [
                            tile(
                                "ISO Market Bids",
                                "api",
                                "Bids, schedules and imbalance positions served back to the ISO and market platforms through governed offer APIs.",
                            ),
                            tile(
                                "PPA Offtaker Sharing",
                                "share",
                                "Metered generation, availability and settlement shared live to offtakers and corporate PPA buyers over Delta Sharing rather than monthly files.",
                            ),
                            tile(
                                "OEM Warranty Sharing",
                                "partner",
                                "Turbine and inverter telemetry shared to OEMs under warranty and availability guarantees, with no copy and no egress duplication.",
                            ),
                        ],
                    },
                    {
                        "box": "Operational Writeback",
                        "ic": "opdb",
                        "tiles": [
                            tile(
                                "Maximo Work Orders",
                                "erp",
                                "Predicted component removals and corrective actions raised as work orders against the asset, in the system O&M already works in.",
                                "maximo",
                            ),
                            tile(
                                "PPC Setpoints",
                                "opdb",
                                "Curtailment and dispatch setpoints written back to the power plant controller so the recommendation reaches the grid.",
                            ),
                            tile(
                                "Field Mobile",
                                "apps",
                                "Scheduled and corrective jobs, checklists and completions pushed to the devices field technicians actually carry.",
                            ),
                        ],
                    },
                    {
                        "box": "Regulatory & ESG",
                        "ic": "gavel",
                        "tiles": [
                            tile(
                                "REC / GO Issuance",
                                "gavel",
                                "Metered generation registered for renewable energy certificate and guarantee-of-origin issuance, produced from the same governed tables the fleet runs on.",
                                "mrets",
                            ),
                            tile(
                                "Emissions Reporting",
                                "sheet",
                                "Avoided-emissions and ESG disclosure filed from contracted Gold products, audit-ready against metered production.",
                                "watershed",
                            ),
                        ],
                    },
                    {
                        "box": "Published Products",
                        "ic": "product",
                        "tiles": [
                            tile(
                                "Data Products",
                                "product",
                                "Published, contracted products discoverable in Unity Catalog Domains and shared over OpenSharing.",
                            ),
                            tile(
                                "Sharing Recipients",
                                "share",
                                "Offtakers, OEMs, lenders and grid partners reading live tables with no copy and no egress duplication.",
                            ),
                        ],
                    },
                ],
                genie_spaces=[
                    genie("Fleet Performance", "Ask about availability, performance ratio and production-to-plan across the fleet in plain language.",
                          feeds=["AVEVA PI System", "Power Factors APM", "GE Vernova SCADA", "Availability, PR, settlement"],
                          teams=["Asset Ops", "Performance Engineers", "Executive Office"],
                          questions=[
                              "What was availability by site yesterday versus plan?",
                              "Which assets are underperforming their P50 case this month?",
                              "How much production have we lost to curtailment this week?",
                              "Which sites show the largest soiling or degradation losses?",
                              "What is fleet performance ratio by technology and OEM?"]),
                    genie("Trading & PPA", "Explore positions, forecast generation, imbalance and PPA settlement across the portfolio.",
                          feeds=["ION Commodities ETRM", "ICE Power Markets", "ERCOT / CAISO", "Revenue Meters / MDM"],
                          teams=["Energy Trading", "PPA Origination", "Battery Schedulers"],
                          questions=[
                              "What is our open position by node for tomorrow?",
                              "How much imbalance cost did we incur last settlement period?",
                              "Which PPAs are most exposed to shape and price risk right now?",
                              "What is battery arbitrage value captured this month?",
                              "How does forecast generation compare to scheduled volume today?"]),
                    genie("O&M & Reliability", "Answer questions on work orders, component health and mean-time-to-repair across the fleet.",
                          feeds=["IBM Maximo EAM", "GE Vernova SCADA", "Salesforce Field Svc", "Conformed asset, meter, PPA"],
                          teams=["O&M & Field", "Reliability Engineers", "Spares & Logistics"],
                          questions=[
                              "Which turbines have predicted component removals this quarter?",
                              "What is mean-time-to-repair by fault type across the fleet?",
                              "Which sites have the largest open work-order backlog?",
                              "Where is truck-roll cost highest relative to generation?",
                              "Which components are we most likely to run short of spares on?"]),
                    genie("Grid & Curtailment", "Ask about dispatch, curtailment, interconnection and grid-code compliance in real time.",
                          feeds=["ISO Dispatch Signals", "ISO Interconnection", "ERCOT / CAISO", "PPC Setpoints"],
                          teams=["Grid Ops", "Interconnection Eng", "Plant Controls"],
                          questions=[
                              "How much generation are we curtailing right now and where?",
                              "Which sites are at risk of a grid-code compliance breach?",
                              "What is our curtailment recovery in settlement this month?",
                              "Where do our interconnection queue milestones stand?",
                              "How are PPC setpoints tracking against dispatch instructions today?"]),
                ],
                dashboards=[
                    dashboard("Fleet Performance", "Availability, performance ratio, loss accounting and production-to-plan on certified Metric Views.",
                              kpis=["Availability", "Performance ratio", "Production vs P50", "Curtailment loss", "Soiling loss"],
                              teams=["Asset Ops", "Performance Engineers", "Executive Office"]),
                    dashboard("Trading & Settlement", "Positions, forecast accuracy, imbalance cost and PPA settlement.",
                              kpis=["Open position", "Forecast accuracy", "Imbalance cost", "PPA settlement", "Battery arbitrage value"],
                              teams=["Energy Trading", "PPA Origination", "Battery Schedulers"]),
                    dashboard("O&M & Reliability", "Work-order backlog, mean-time-to-repair, truck-roll cost and component health.",
                              kpis=["Work-order backlog", "Mean-time-to-repair", "Truck-roll cost", "Predicted removals", "Warranty recovery"],
                              teams=["O&M & Field", "Reliability Engineers", "Spares & Logistics"]),
                    dashboard("ESG & Carbon", "REC issuance, guarantee-of-origin and avoided-emissions reconciled to metered generation.",
                              kpis=["REC issuance", "Guarantees of origin", "Avoided emissions", "Metered generation", "Retirement volume"],
                              teams=["Executive Office", "Grid Ops", "Asset Ops"]),
                ],
            ),
        },
        "top": top_band(
            [
                app(
                    "APM Control Room",
                    "Fleet performance",
                    "gauge",
                    "The screen the performance team runs the fleet from: availability, performance ratio and underperformance by site and asset, loss accounting and production-to-plan, on Databricks Apps over Lakebase.",
                ),
                app(
                    "Trading & Dispatch",
                    "Market & PPA",
                    "market",
                    "Where traders and schedulers see forecast generation, position and imbalance risk against live ISO prices, and place bids and battery schedules with the shape and hedge in one view.",
                ),
                app(
                    "O&M Work Planner",
                    "Field & maintenance",
                    "erp",
                    "Predicted failures and corrective actions turned into scheduled work orders, sequenced against crews, spares and site access, and written back into Maximo.",
                ),
                app(
                    "ESG & REC Ledger",
                    "Carbon & certificates",
                    "gavel",
                    "Metered generation reconciled to REC and guarantee-of-origin issuance and avoided-emissions accounting, audit-ready for the board and the offtaker.",
                ),
            ],
            [
                uc(
                    "Predictive Maintenance",
                    "Turbine & inverter",
                    "iot",
                    "Predicting component failure from SCADA, vibration and defect history so a gearbox or inverter fault becomes a planned visit, not an unplanned outage.",
                    problem="An unplanned turbine or inverter failure means lost generation and an emergency truck roll. Removals need predicting from actual condition, not a calendar, before the fault takes the asset offline.",
                    who="O&M & Field",
                    how="PI historian, GE and Huawei SCADA and Maximo defect history feed remaining-useful-life models tracked in MLflow and scored in Model Serving; predicted removals raise work orders from the O&M Work Planner.",
                    comps=["O&M Work Planner", "AVEVA PI System", "MLflow", "Model Serving", "IBM Maximo EAM"],
                    stories=[
                        ["Databricks and Shell: industrial time series for asset monitoring", "https://www.databricks.com/blog/developing-time-series-lakehouse-shell"],
                        ["Predictive maintenance on the Databricks Lakehouse", "https://www.databricks.com/blog/what-is-predictive-maintenance"],
                    ],
                ),
                uc(
                    "Fleet Performance",
                    "Availability & PR",
                    "gauge",
                    "Availability, performance ratio and loss accounting across a mixed-OEM solar, wind and storage fleet, so underperformance is found and closed against the production case.",
                    problem="Underperformance hides in per-OEM SCADA silos and monthly reports; by the time a soiling loss or a curtailment pattern is spotted, weeks of generation are already gone.",
                    who="Asset Ops",
                    how="SCADA and APM feeds are conformed to certified Gold; availability, PR and loss accounting are explored in AI/BI and surfaced in the APM Control Room on definitions certified in Unity Catalog.",
                    comps=["APM Control Room", "Power Factors APM", "AVEVA PI System", "AI/BI", "Unity Catalog"],
                    stories=[
                        ["E.ON advances asset management with Databricks", "https://www.databricks.com/customers/eon"],
                        ["Databricks for Energy", "https://www.databricks.com/solutions/industries/energy"],
                    ],
                ),
                uc(
                    "Generation Forecasting",
                    "Production & weather",
                    "chart",
                    "Short and medium-term generation forecasts conditioned on weather, so schedules, hedges and imbalance are priced on what the fleet will actually produce.",
                    problem="Wind and solar output is intermittent; forecasts built on stale weather and disconnected telemetry are wrong at exactly the hours that price imbalance the hardest.",
                    who="Asset Ops",
                    how="Irradiance and wind forecasts join live telemetry in the lakehouse; generation models defined in Feature Store and tracked in MLflow score through Model Serving into the APM Control Room and the trading desk.",
                    comps=["APM Control Room", "Weather & Irradiance", "Model Serving", "Feature Store", "MLflow"],
                    stories=[
                        ["Sympower scales forecasting and grid balancing on Databricks", "https://www.databricks.com/customers/sympower"],
                        ["Databricks for Energy", "https://www.databricks.com/solutions/industries/energy"],
                    ],
                ),
                uc(
                    "Energy Trading & PPA",
                    "Market revenue",
                    "market",
                    "Scheduling and hedging generation into the ISO and valuing PPA and offtake shape, so revenue is captured across price, imbalance and the contract structure.",
                    problem="Generation, price forecasts and PPA terms live in different systems, so bids are placed without the shape or the hedge in view and imbalance and offtake risk are settled after the fact.",
                    who="Energy Trading",
                    how="ETRM positions and ICE forward curves are conformed in the lakehouse; price and generation models score each schedule through Model Serving behind the Trading & Dispatch desk.",
                    comps=["Trading & Dispatch", "ION Commodities ETRM", "ICE Power Markets", "Model Serving", "AI/BI"],
                    stories=[
                        ["Octopus Energy: data-powered clean energy on Databricks", "https://www.databricks.com/customers/octopus-energy"],
                        ["SSE Energy Solutions lowers emissions with Databricks", "https://www.databricks.com/customers/sse"],
                    ],
                ),
                uc(
                    "Curtailment & Dispatch",
                    "Grid signals",
                    "network",
                    "Responding to ISO dispatch and curtailment instructions in real time, minimising lost generation and settling curtailment accurately.",
                    problem="Curtailment and dispatch instructions arrive at grid latency; handled by hand or reconciled monthly, lost generation is over-curtailed and under-recovered in settlement.",
                    who="Grid Ops",
                    how="ISO dispatch signals stream into Lakehouse//RT; setpoint recommendations are scored in Model Serving and written back as PPC Setpoints, with curtailment reconciled for settlement.",
                    comps=["PPC Setpoints", "ISO Dispatch Signals", "Lakehouse//RT", "Model Serving"],
                    stories=[
                        ["Sympower stabilises the grid with flexibility on Databricks", "https://www.databricks.com/customers/sympower"],
                    ],
                ),
                uc(
                    "Storage Optimisation",
                    "Battery dispatch",
                    "store",
                    "Cycling battery storage against energy and ancillary-market prices, so each charge and discharge captures the most value within warranty and state-of-health limits.",
                    problem="Battery value leaks when dispatch ignores forward prices, ancillary opportunity or degradation; cycled by rule of thumb, the asset trades against itself and ages faster than it earns.",
                    who="Energy Trading",
                    how="Live price and telemetry land in Lakehouse//RT; a dispatch model scored in Model Serving optimises cycling against ERCOT and CAISO prices from the Trading & Dispatch desk.",
                    comps=["Trading & Dispatch", "Model Serving", "Lakehouse//RT", "ERCOT / CAISO", "AI/BI"],
                    stories=[
                        ["Octopus Energy: data-powered clean energy on Databricks", "https://www.databricks.com/customers/octopus-energy"],
                    ],
                ),
                uc(
                    "Grid Interconnection",
                    "Queue & compliance",
                    "network",
                    "Managing interconnection queue position, grid-code compliance and availability-to-grid, so a project energises on schedule and stays compliant once live.",
                    problem="Interconnection terms, queue milestones and grid-code obligations sit in ISO documents and spreadsheets; missed conditions delay energisation and risk compliance penalties.",
                    who="Grid Ops",
                    how="Interconnection and compliance data are conformed in the lakehouse against live telemetry; queue and compliance status is explored in AI/BI and asked of Genie One on Unity Catalog definitions.",
                    comps=["ISO Interconnection", "AI/BI", "Unity Catalog", "Genie One"],
                    stories=[
                        ["E.ON consolidates grid asset data on Databricks", "https://www.databricks.com/customers/eon"],
                    ],
                ),
                uc(
                    "O&M & Field Service",
                    "Work orders",
                    "erp",
                    "Turning predicted and corrective work into scheduled field jobs, sequenced against crews, spares and site access, and closed on mobile.",
                    problem="Work orders, technician schedules and spares live in separate systems, so crews are dispatched inefficiently, truck rolls stack up and warranty recovery is missed.",
                    who="O&M & Field",
                    how="Maximo and field-service feeds are conformed in the lakehouse; the O&M Work Planner on Lakebase sequences jobs and Agent Bricks drafts work orders against governed tools.",
                    comps=["O&M Work Planner", "IBM Maximo EAM", "Salesforce Field Svc", "Agent Bricks", "Lakebase"],
                    stories=[
                        ["Databricks and Shell: asset monitoring and work-order history", "https://www.databricks.com/blog/developing-time-series-lakehouse-shell"],
                    ],
                ),
                uc(
                    "ESG & Carbon",
                    "RECs & carbon",
                    "gavel",
                    "Reconciling metered generation to REC and guarantee-of-origin issuance and avoided-emissions accounting, audit-ready for the board and offtakers.",
                    problem="RECs, guarantees of origin and carbon disclosure are stitched together from meter extracts and spreadsheets at reporting time, so issuance is late and the audit trail is fragile.",
                    who="Executive Office",
                    how="Metered generation is conformed to Gold and reconciled to REC Registries and Watershed Carbon; the ESG & REC Ledger publishes issuance and disclosure through AI/BI on Unity Catalog definitions.",
                    comps=["ESG & REC Ledger", "REC Registries", "Watershed Carbon", "AI/BI", "Unity Catalog"],
                    stories=[
                        ["SSE Energy Solutions lowers carbon emissions with Databricks", "https://www.databricks.com/customers/sse"],
                        ["TotalEnergies powers cleaner energy with Databricks", "https://www.databricks.com/customers/totalenergies"],
                    ],
                ),
                uc(
                    "Portfolio & Finance",
                    "IRR & tax equity",
                    "sheet",
                    "Measuring portfolio returns, project-finance covenants and tax-equity waterfalls against live generation and settlement, so the investment case tracks reality.",
                    problem="Returns, debt covenants and tax-equity flows are modelled in spreadsheets against stale production, so the portfolio's real performance is only known at quarter close.",
                    who="Executive Office",
                    how="Generation, settlement and cost feeds are conformed against the Project Finance marts; returns and covenants are analysed in AI/BI and asked of Genie One, published as governed Data Products.",
                    comps=["Project Finance", "AI/BI", "Genie One", "Unity Catalog", "Data Products"],
                    stories=[
                        ["TotalEnergies powers cleaner energy with Databricks", "https://www.databricks.com/customers/totalenergies"],
                    ],
                ),
            ],
        ),
        "sources": {
            "pi": {"t": "AVEVA PI System", "u": "https://www.aveva.com/en/products/aveva-pi-system/"},
            "ge-vernova": {"t": "GE Vernova Wind", "u": "https://www.gevernova.com/wind-power"},
            "powerfactors": {"t": "Power Factors APM", "u": "https://www.powerfactors.com/"},
            "fusionsolar": {"t": "Huawei FusionSolar", "u": "https://solar.huawei.com/"},
            "ercot": {"t": "ERCOT market", "u": "https://www.ercot.com/"},
            "caiso": {"t": "CAISO market", "u": "https://www.caiso.com/"},
            "ion": {"t": "ION commodities ETRM", "u": "https://iongroup.com/"},
            "molecule": {"t": "Molecule ETRM", "u": "https://www.molecule.io/"},
            "ice": {"t": "ICE power and energy markets", "u": "https://www.ice.com/"},
            "maximo": {"t": "IBM Maximo Application Suite", "u": "https://www.ibm.com/products/maximo"},
            "sap-eam": {"t": "SAP Enterprise Asset Management", "u": "https://www.sap.com/products/erp/asset-management.html"},
            "salesforce-fs": {"t": "Salesforce Field Service", "u": "https://www.salesforce.com/products/field-service/overview/"},
            "servicemax": {"t": "ServiceMax field service", "u": "https://www.servicemax.com/"},
            "itron": {"t": "Itron metering and MDM", "u": "https://www.itron.com/"},
            "ferc": {"t": "FERC electric transmission and interconnection", "u": "https://www.ferc.gov/electric-transmission"},
            "mrets": {"t": "M-RETS renewable energy certificate registry", "u": "https://www.mrets.org/"},
            "watershed": {"t": "Watershed carbon accounting", "u": "https://watershed.com/"},
            "solcast": {"t": "Solcast solar and weather forecasting", "u": "https://solcast.com/"},
        },
    }
}
