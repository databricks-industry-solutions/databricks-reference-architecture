#!/usr/bin/env node
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { serve, boardReady, withView } = require('./lib_serve');

const ROOT = path.join(__dirname, '..');
const TR = path.join(ROOT, 'app', 'translations');
const LANGS = JSON.parse(fs.readFileSync(path.join(TR, 'manifest.json'), 'utf8')).languages.map(l => l.code).filter(c => c !== 'en');
const SAME = JSON.parse(fs.readFileSync(path.join(__dirname, 'i18n_same.json'), 'utf8'));
const html = fs.readFileSync(path.join(ROOT, 'app', 'index.html'), 'utf8');
const heWord = s => new RegExp('(?:^|[^\u05D0-\u05EA])' + s + '(?=[^\u05D0-\u05EA]|$)');
const FIN_FILES = ['_common', 'payments_fintech', 'exchanges', 'data_analytics_providers', 'capital_markets_buyside', 'capital_markets_sellside', 'wealth_management', 'banking', 'crypto_digital_assets',
  'insurance_pandc', 'life_insurance', 'mortgage_lending'];
const MFG_FILES = ['_common', 'semiconductors', 'chemical_mfg', 'manufacturing', 'paper_packaging', 'medical_devices', 'computer_electronics', 'automotive', 'aerospace_space', 'machinery', 'food_beverage',
  'pharmaceuticals', 'mining', 'oil_gas_downstream_refining', 'consumer_goods', 'genomics_biotech'];
const DISPATCH_FILES = ['electric_power_generation', 'renewables', 'electric_utility', 'water_utilities', 'waste_management', 'public_safety', 'rail_transit', 'mining', 'telecommunication',
  'transport_shipping', 'semiconductors', 'machinery', 'medical_devices', 'construction', 'staffing_hr', 'oil_gas_midstream', 'airlines'];
const LOT_FILES = ['semiconductors', 'computer_electronics', 'pharmaceuticals', 'medical_devices', 'food_beverage', 'chemical_mfg', 'consumer_goods', 'manufacturing', 'aerospace_space', 'genomics_biotech',
  'machinery', 'automotive'];
const SALES_LEAD_FILES = ['automotive', 'retail', 'grocery', 'ecommerce', 'advertising', 'consumer_goods', 'telecommunication', 'media_broadcasting', 'real_estate', 'travel_hospitality',
  'insurance_pandc', 'life_insurance', 'banking', 'mortgage_lending', 'staffing_hr', 'pharmaceuticals'];
const TOUR = [...((html.match(/const STEPS = \[([\s\S]*?)\n  \];/) || [])[1] || '').matchAll(/\b(?:title|body):"((?:[^"\\]|\\.)*)"/g)].map(m => JSON.parse('"' + m[1] + '"'));

const SENSE = [
  { what: 'ingestion read as eating or swallowing', src: /\bingest/i,
    bad: { de: /einnahme/i, nl: /\binname|innemen|inslik/i, da: /indtag/i, ja: /摂取/, ko: /섭취/, sv: /förtär/i, fi: /niel/i, he: /בליע|נבלע|להיבלע|הכנסת מזון/, ar: /ابتلاع/, zh: /摄入|吞/, hi: /निगल/ } },
  { what: 'work teams read as sports teams', src: /\bteams?\b/i, except: /Microsoft Teams|Teams & M365|in Teams\b|League|venues|fan engagement|Team President/i,
    bad: { de: /mannschaft/i, fi: /joukkue/i, sv: /\blag (om|för)\b|^lag$/i } },
  { what: 'cloud read as weather', src: /^cloud$/i,
    bad: { de: /^wolke$/i, nl: /^wolk$/i, ja: /^雲$/, ko: /^구름$/, ar: /^سحاب$/, hi: /^बादल$/, it: /^nuvola$/i, fr: /^nuage$/i, da: /^sky$/i } },
  { what: 'a board box read as a physical container', src: /\bbox(es)?\b/i, only: TOUR,
    bad: { nl: /\bdoos/i, sv: /låda/i, it: /scatol/i, zh: /盒子/, he: /קופס/, ko: /상자/, es: /\bcaja/i } },
  { what: 'the guided tour read as a concert tour or a stroll', src: /\btour\b/i, only: TOUR,
    bad: { fr: /tournée/i, sv: /turné/i, fi: /kiertue/i, pt: /passeio/i } },
  { what: 'a release stage read as a theatre stage', src: /\bstage\b/i, only: TOUR.concat(['Stage']),
    bad: { de: /bühne/i, fr: /\bscène/i, pt: /palco/i, nl: /podium/i, it: /palcoscenico/i, sv: /\bscen\b/i, ko: /무대/, fi: /näyttämö/i, he: /במה/, hi: /मंच/, da: /\bscene\b/i } },
  { what: 'the light or dark theme read as light and darkness', src: /\blight or dark\b/i,
    bad: { zh: /光明|黑暗/, ko: /빛 또는 어둠/, hi: /अंधकार/ } },
  { what: 'highlights read as reflections or stripes', src: /^highlights$/i, bad: { es: /reflejo/i, he: /פסים/ } },
  { what: 'agent memory read as computer RAM', src: /\bmemor(y|ies)\b/i, except: /\b\d+\s*(GB|GiB|TB)\b|in-memory|\bRAM\b/i,
    bad: { zh: /内存/ } },
  { what: 'compute instances read as examples or cases', src: /\binstances?\b/i,
    bad: { hi: /उदाहरण/, he: /מקרים/, ar: /حالات/ } },
  { what: 'a GovCloud region read as a governor or a government', src: /^US Gov\b/,
    bad: { de: /gouverneur|regierung/i, es: /gobern/i, pt: /governa|governo/i, it: /governat|governo/i, fr: /gouvern/i, nl: /regering/i,
           sv: /regering/i, fi: /hallitus/i, da: /regering|guvern/i, ja: /知事|政府/, ko: /주지사|정부/, zh: /政府/, ar: /حكوم|حاكم/, he: /ממשל|מושל/ } },
  { what: 'model serving read as a tennis serve, a cash withdrawal or serving food', src: /\bserv(ing|ed)\b/i,
    bad: { de: /aufschlag/i, pt: /\bsaques?\b/i, fi: /tarjoil/i } },
  { what: 'model training read as sports practice or an internship', src: /\btraining\b/i, except: /athlete|training load/i,
    bad: { it: /allenament/i, fi: /harjoittel/i } },
  { what: 'a job run read as a race', src: /\bruns?\b/i, except: /home run|\brace\b/i,
    bad: { pt: /\bcorridas?\b/i, it: /\bcors[ae]\b/i, es: /\bcarreras?\b/i, fi: /juoks/i } },
  { what: 'an endpoint read as a full stop or a final point', src: /\bendpoints?\b/i,
    bad: { es: /puntos? finales?/i, fr: /points? fina(l|ux)\b/i, hi: /समापन बिंदु/ } },
  { what: 'a compute plane read as an aircraft or as an order to calculate', src: /\bcompute plane\b/i,
    bad: { ar: /طائر/, he: /מטוס/, hi: /विमान/, it: /aereo/i, pt: /avião/i, es: /avión/i, de: /flugzeug/i, ja: /飛行機/, ko: /비행기|평면/, zh: /飞机/,
           da: /\bfly\b|^beregn\b/i, fi: /^laske\b/i, fr: /^calculer\b/i, sv: /^beräkna\b/i, nl: /^bereken\b|\bplane\b/i } },
  { what: 'compute read as an account or a sum', src: /\bcompute\b/i, except: /\baccount\b/i,
    bad: { ar: /(^|[\s،])(ال)?حساب($|[\s،.])/ } },
  { what: 'a lakehouse read as a house by a lake', src: /\blakehouses?\b/i,
    bad: { it: /casa sul lago|casa del lago/i, fi: /järvitalo/i, he: /בית ה?אגם/, ja: /湖畔|湖の家/, es: /casa (del|junto al) lago/i, pt: /casa (do|no) lago|casa à beira/i,
           fr: /maison (du|au bord du|sur le) lac/i, de: /seehaus/i, nl: /meerhuis|huis aan het meer/i, sv: /sjöhus|sjöstuga/i, da: /søhus/i, ko: /호숫가|호수 집|호수의 집/,
           zh: /湖边|湖畔|湖屋/, ar: /(بيت|منزل|كوخ) البحيرة|(من|في|إلى|على) البحيرة/ } },
  { what: 'rail linear assets read as wealth or the maglev line', src: /\blinear (and infrastructure )?assets?\b|\bLinear Asset\b/i,
    bad: { nl: /vermogen/i, it: /patrimon/i, de: /vermögen/i, ja: /リニア/, fi: /varallisuu|sijoitus/i, sv: /förmögenhet/i, da: /formue/i, hi: /संपत्ति/, fr: /patrimoin/i, es: /patrimonio/i, pt: /patrimônio|patrimonio/i } },
  { what: 'a plant historian read as a person who studies history', src: /\bhistorians?\b/i,
    bad: { ...Object.fromEntries(['de', 'nl', 'sv', 'da', 'es', 'pt', 'fr', 'it'].map(l => [l, { test: t => !/historian/i.test(t) }])),
           ko: { test: t => !t.includes('히스토리언') }, ja: { test: t => !t.includes('ヒストリアン') }, hi: { test: t => !t.includes('हिस्टोरियन') },
           fi: /historioitsij/i, ar: /مؤرخ|مؤرّخ/, he: /היסטוריו[נן]/, zh: /历史学家/ } },
  { what: 'the factory shop floor read as a store', src: /\bshop[- ]?floors?\b/i, except: /\bcustomers?\b|\bassociates?\b|\bretail|\bshoppers?\b/i,
    bad: { de: /\bladen(fläche|boden)|verkaufsfläche/i, da: /butik/i, sv: /butik/i, nl: /winkel/i, fi: /myymälä|\bkaupa(n|ssa|lla)\b/i, ar: /متجر|متاجر/, he: /חנות/,
           ko: /매장|상점|가게/, es: /tienda/i, pt: /\bloja/i, fr: /magasin|boutique/i, it: /negozio/i, hi: /दुकान/, ja: /店舗|お店/, zh: /商店|店铺/ } },
  { what: 'an industrial plant read as vegetation', src: /\b(?<!power )(?<!SAP )plants?\b/i,
    except: /\b(crops?|seeds?|breed\w*|agronom\w*|planting|germplasm|nurser(y|ies)|greenhouses?|horticult\w*|pollinat\w*|herbicides?|weeds?|orchards?|vineyards?|plant (health|science|protection|nutrition))\b/i,
    bad: { de: /pflanze/i, nl: /\bplant(en)?\b|planten/i, he: /צמח/, ar: /نبات|النبات/, it: /\bpiant[ae]\b/i, sv: /\bväxt/i, da: /\bplante/i, fi: /\bkasvi/i,
           ko: /식물/, ja: /植物/, zh: /植物/, hi: /पौध/, fr: /\bplantes?\b/i } },
  { what: 'a data feed read as animal fodder', src: /\bfeeds?\b/i,
    except: /\b(feedstocks?|assays?|crude|livestock|animals?|fodder|cattle|poultry|aquaculture|feed (mill|conversion|ration)s?|feedlots?)\b/i,
    bad: { de: /futter/i, nl: /\b(het|de|ruw|ruwe|dagelijks|dagelijkse)\s+voer\b|voeders?\b|veevoer/i, ar: /أعلاف|علف/, it: /mangim/i, zh: /饲料/, ja: /飼料/, ko: /사료/, es: /pienso|forraje/i, pt: /\bração\b|forragem/i,
           sv: /\bfoder\b|djurfoder/i, da: /\bfoder\b|dyrefoder/i, fi: /\brehu/i } },
  { what: 'machine-learning features read as product functions', src: /features? read identically|Feature Store|\bfeatures? (for|from|on|in) (training|serving)|\bfeature (tables?|engineering|pipelines?)\b/i,
    bad: { de: /funktionen/i, sv: /funktioner/i, da: /funktioner/i, nl: /functies/i, it: /funzionalit/i, ko: /기능/, ja: /機能/, zh: /功能/, hi: /सुविधा/ } },
  { what: 'deploying to production read as freight shipping', src: /\bship(s|ped|ping)?\b[^.;]{0,60}\b(to|into|in) production\b|\b(after|once|before) (it|they|the model) (is |are )?shipped\b|\bshipp?(ing|ed) (agents|apps|models|it|them)\b/i,
    bad: { de: /versand|verschick|versend/i, fr: /expédi/i, es: /\benv[ií]/i, pt: /\benvi[oa]/i, it: /spedi/i, nl: /expedi|verzend|verscheep/i, sv: /frakt|skeppa|skickad/i,
           da: /forsend|afsend|sendt/i, fi: /lähetet|laivat/i, ja: /出荷|発送|配送/, ko: /배송|발송|출하/, zh: /发货|运送|装运/, ar: /شحن/, he: /משלוח|שילוח|נשלח/, hi: /शिपिंग|भेज/ } },
  { what: 'notebooks read as laptops', src: /\bnotebooks?\b/i,
    bad: { es: /portátil/i, sv: /bärbar/i, fi: /kannettav/i, he: /מחשב(ים)? נייד|ניידים/, it: /portatil/i, fr: /ordinateur portable/i, de: /laptop/i, nl: /laptop/i,
           da: /bærbar/i, ja: /ノートパソコン/, zh: /笔记本电脑/, ar: /محمول/, hi: /लैपटॉप/, pt: /laptop/i } },
  { what: 'a water or gas main read as "primary"', src: /\bmains?[- ](breaks?|bursts?|replacement|renewal|condition|failures?)\b|\b(a|the) mains? (breaks?|bursts?)\b|\bmains\b/i,
    except: /\b(electric\w*|power grid|voltage|substations?|AC mains)\b/i,
    bad: Object.fromEntries(Object.entries({ de: /leitung|rohr/i, nl: /leiding|buis|buizen|pijp/i, sv: /ledning|rör/i, da: /ledning|rør/i, fi: /putk|johto|johdo/i,
      it: /condott|condutt|tubaz|tubatur|\btub[oi]\b|rete idrica/i, pt: /tubula|adutor|\bcanos?\b|\btubos?\b|encanament/i, es: /tuber|conduc|cañer|\blíneas?\b|\bredes?\b/i, fr: /canalis|conduite/i,
      ja: /[配水道本]管|管路|管網|パイプ/, zh: /管道|水管|干管|管网|管线|干线|爆管/, ko: /배관|수도관|송수관|주철관|관로|상수관|파이프/, he: /צינור|צנרת|קווי? מים/,
      ar: /أنابيب|أنبوب|مواسير|ماسورة|خطوط|خط/, hi: /पाइप|मेन|लाइन/ }).map(([l, ok]) => [l, { test: t => (l === 'zh' && /主管/.test(t)) || (!ok.test(t) && !/\bmains?\b|Main Replacement Planner/i.test(t)) }])) },
  { what: 'a field work crew read as a ship or aircraft crew', src: /\bcrews?\b/i,
    notOn: ['airlines', 'rail_transit', 'shipping_ports', 'transport_shipping', 'aerospace_space', 'travel_hospitality'],
    bad: { it: /equipagg/i, fr: /équipage/i, es: /tripulac/i, pt: /tripula/i, de: /besatzung/i, nl: /bemanning/i, sv: /besättning/i, da: /besætning/i,
           fi: /miehist/i, ja: /乗組員|乗務員/, zh: /机组|船员/, ko: /승무원/ } },
  { what: 'a grain elevator read as a lift', src: /\belevators?\b/i, onlyOn: ['agriculture'],
    bad: { it: /ascensor/i, fr: /ascenseur/i, es: /ascensor/i, de: /aufzug|fahrstuhl/i, nl: /\blift/i, sv: /\bhiss/i, fi: /hissi/i, zh: /电梯/, he: /מעלית/,
           ar: { test: t => /مصعد|المصعد/.test(t) && !/الحبوب/.test(t) }, hi: { test: t => /लिफ्ट|एलिवेटर/.test(t) && !/अनाज/.test(t) }, pt: { test: t => /elevador/i.test(t) && !/gr[ãa]os?|cereais/i.test(t) }, da: { test: t => /elevator/i.test(t) && !/korn/i.test(t) },
           ja: { test: t => /エレベーター/.test(t) && !/穀物|カントリー/.test(t) }, ko: { test: t => /엘리베이터/.test(t) && !/곡물/.test(t) } } },
  { what: 'data lineage read as ancestry', src: /\blineage\b/i,
    bad: { de: /abstammung|stammbaum/i, nl: /afstamming|stamboom/i, sv: /härstamning|släktlinje/i, fi: /sukulinja|polveutu|sukupuu/i, fr: /\blignées?\b/i,
           it: /\bstirpe|discendenza/i, zh: /血统|世系/, hi: /वंशावली/, ja: /血統|家系/, ko: /혈통|가계/ } },
  { what: 'loading data read as landing an aircraft', src: /^Lands?\b/,
    bad: { it: /atterr/i, fr: /atterr/i, es: /aterriz/i, pt: /aterriss|pous[ae]/i, de: /^lande|landen sie/i, nl: /^land\b/i, sv: /^landa/i, da: /^land\b|^lande/i,
           fi: /^maadoi|laskeut|^laske/i, ja: /着陸/, zh: /着陆|降落|登陆/, ko: /착륙/, he: /^קרקע|נחת|הנחת/, ar: /هبوط|اهبط|أهبط/, hi: /उतार|^लैंड/ } },
  { what: "a description's opening verb read as a noun", src: /^(Bridges|Stores)\b/,
    bad: { ar: /^(ال)?جسور|^(تقوم )?(ال)?متاجر/, hi: /^ब्रिजेस/ } },
  { what: 'an AI copilot read as an aircraft co-pilot', src: /\bcopilots?\b/i,
    bad: { ja: /副操縦/, ko: /부조종사/, he: /טייס/, ar: /طيّ?ار/, fi: /perämie/i, hi: /सह-?पायलट/ } },
  { what: 'an AI agent read as a human officer, broker or a chemical agent', src: /\bagents?\b/i,
    except: /agent assist|contact[- ]cent|call[- ]cent|live agents?|human agents?|agent desktop|(travel|insurance|real estate|leasing|shipping|port|customs|field|sales|talent|booking|ticket|support|service) agents?|agents? (and|&) brokers?|agent (network|banking|channel)s?|\bbrokers?\b|by agents?\b|agent commissions?|agents? (and|&) policyholders?|agent[- ]performance|\b(per-)?employees?\b|\bstaff\b|workforce|(insureds|policyholders),? agents|agents?,? (and )?insureds|which agents|agents chase|\bco-?workers?\b/i,
    bad: { de: /beauftragte|sachbearbeiter|\bvertreter|\bmakler|\bmittel\b|trennmittel|mitarbeiter/i, nl: /makelaar|functionaris|medewerker|\bmiddel\b|vertegenwoordiger/i,
           da: /\bmiddel\b|medarbejder|repræsentant|mægler/i, sv: /\bmedel\b|ombud|handläggare|mäklare/i, fi: /edustaja|virkailija|välittäjä|\baine(et)?\b/i,
           fr: /agent chimique|représentant|courtier|préposé/i, es: /agente químico|representante|corredor/i, it: /agente chimico|rappresentante|intermediario|addetto/i,
           pt: /agente químico|representante|corretor/i, ja: /代理人|工作員/, ko: /대리인|요원/, zh: /代理人|特工/ } },
  { what: 'crude oil read as raw or rough', src: /\bcrude\b/i,
    bad: Object.fromEntries(['de', 'nl', 'sv', 'da', 'fi', 'fr', 'es', 'it', 'pt', 'ja', 'zh', 'ko', 'he', 'ar', 'hi'].map(l => [l,
      { test: t => !/öl|olie|olja|olje|öljy|pétrole|\bbrut\b|petróleo|petrolio|greggio|grezz|crudo|原油|석유|원유|نفط|الزيت الخام|הנפט|נפט|שמן גולמי|तेल|क्रूड|crude/i.test(t) }])) },
  { what: 'staff credentials read as login data', src: /\bcredential/i, onlyOn: ['staffing_hr', 'healthcare', 'health_insurance', 'digital_health', 'education'],
    except: /\blogin|password|secret|\bAPI\b|token|vault|stolen|leaked|phish|access/i,
    bad: { de: /zugangsdaten|anmeldedaten|anmeldeinformation/i, da: /legitimationsoplysninger|loginoplysninger|adgangsoplysninger/i, fi: /valtuustie|kirjautum|tunnistetie/i,
           nl: /inloggegevens/i, sv: /inloggningsuppgifter/i, fr: /identifiants/i, it: /credenziali di accesso/i, pt: /credenciais de acesso/i, ja: /認証情報/, zh: /凭据|凭证/, ko: /자격 증명/ } },
  { what: 'venue food concessions read as licences', src: /\bconcessions?\b/i, onlyOn: ['sports_entertainment', 'travel_hospitality', 'restaurants'],
    bad: { da: /koncession/i, de: /konzession/i, nl: /concessie/i, sv: /koncession/i, fi: /toimilu/i, es: /concesion/i, it: /concession/i, pt: /concess/i, zh: /特许/, ja: /営業権|特許/, ko: /특허|양허/ } },
  { what: 'a data, sales or drug pipeline read as a physical pipe', src: /\bpipelines?\b/i,
    notOn: ['oil_gas_midstream', 'oil_gas_upstream', 'oil_gas_downstream_refining', 'water_utilities', 'electric_utility', 'chemical_mfg'],
    except: /\b(gas|oil|crude|water|hydrogen|CO2|pigging|midstream)\b|pipeline (integrity|inspection|corrosion|leak|pressure|hydraulics|nomination)/i,
    bad: { de: /rohrleitung/i, nl: /pijpleiding/i, sv: /rörledning/i, da: /rørledning/i, fi: /putkilinja|putkisto/i, fr: /oléoduc|gazoduc|canalisation/i,
           es: /tubería|oleoducto|gasoducto/i, it: /condotta|oleodotto|gasdotto|tubazione/i, pt: /tubula|oleoduto|gasoduto|encanamento/i, ja: /配管|管路/, ko: /배관|송유관/ } },
  { what: 'a clinical trial read as a try-out or a test', src: /\btrials?\b/i, onlyOn: ['_common', 'clinical_trials', 'pharmaceuticals', 'genomics_biotech', 'healthcare', 'medical_devices', 'diagnostics_labs', 'digital_health'],
    except: /free trial|trial (period|account|version|subscription)|trial-to-paid|trial conversion|\bsamples?\b|sample-|field trials?|crop trials?|plot trials?|variety trials?|on-farm trials?/i,
    bad: { fi: /kokeilu/i, de: /probelauf|testlauf|testphase/i, sv: /\bprov(?!ning|ningar)|provregistr/i, da: /prøve/i, fr: /essai gratuit|période d'essai/i,
           es: /prueba gratuita|periodo de prueba/i, it: /prova gratuita|periodo di prova/i, pt: /teste gratuito|período de teste/i, ja: /お試し|試用/, zh: /试用/, ko: /체험|평가판/ } },
  { what: 'a clinical study read as schooling', src: /\bstud(?:y|ies)\b/i, onlyOn: ['clinical_trials', 'pharmaceuticals', 'genomics_biotech', 'medical_devices', 'diagnostics_labs'],
    except: /case stud|time and motion/i,
    bad: { fi: /opinto|opiskel/i, he: /לימודים/, ja: /学習計画|勉強/, zh: /学习计划/, ko: /학습 계획|공부/, es: /plan(?:es)? de estudios/i,
           it: /pian[oi] di studi\b/i, pt: /planos? de estudos/i, fr: /plans? d'études/i, ar: /منهج دراسي|مقرر دراسي/ } },
  { what: 'financial reconciliation read as making peace', src: /\breconcil/i,
    bad: { de: /versöhn/i, nl: /verzoen/i, sv: /försoning/i, da: /forsoning/i, fi: /sovinto|sovittel/i, ja: /和解/, zh: /和解/, ko: /화해/, he: /פיוס/, hi: /सुलह/ } },
  { what: 'a design space read as outer space', src: /\bdesign space\b/i,
    bad: { de: /weltraum|weltall/i, nl: /ruimtevaart|heelal/i, es: /espacio exterior/i, fi: /avaruu/i, sv: /rymden/i, da: /verdensrum/i, it: /spazio cosmico/i, ja: /宇宙/, zh: /太空|宇宙/, ko: /우주/, he: /חלל/ } },
  { what: 'a digital thread read as yarn', src: /\bdigital thread\b/i,
    bad: { de: /garn/i, nl: /garen/i, sv: /\bgarn/i, da: /\bgarn/i, fi: /lanka/i, fr: /\bfil à|\bfils? de laine/i, es: /hilo de coser|\bhilaza/i, it: /filato/i, pt: /\bfio de lã/i, ja: /糸/, zh: /纱|毛线/, ko: /실타래|털실/ } },
  { what: 'a legal or contract review read as a critique', src: /\b(legal|contract|document|privilege|compliance|contestable) reviews?\b/i,
    bad: { de: /kritik|rezension/i, fr: /\bcritique/i, es: /reseña|crítica/i, it: /recensione|\bcritica/i, pt: /resenha|crítica/i, nl: /recensie|kritiek/i, sv: /recension|kritik/i,
           da: /anmeldelse|kritik/i, fi: /arvostelu|kritiikk/i, ja: /批評/, zh: /书评|评论/, ko: /비평|평론/ } },
  { what: 'a capacity or demand surge read as an electrical surge', src: /\bsurges?\b/i, except: /power surge|voltage|storm surge|electric|lightning/i,
    bad: { de: /überspannung|spannungsspitze/i, nl: /overspanning|stroomstoot/i, fr: /surtension/i, es: /sobretensi/i, it: /sovratensi/i, pt: /sobretens|surto de tensão/i,
           sv: /överspänning|spänningsspik/i, da: /overspænding|strømstød/i, fi: /ylijännit|jännitepiik/i, ja: /過電圧|サージ電圧/, zh: /浪涌|电涌/, ko: /과전압/, he: /נחשול מתח/ } },
  { what: 'prior authorization read as an earlier login', src: /\bprior auth/i,
    bad: { de: /authentifiz|anmeldung|vorherige auth/i, nl: /authenticat|eerdere auth/i, sv: /autentiser|tidigare auth/i, da: /autentific|tidligere auth/i, fi: /todennu|tunnistautu|aiempi/i,
           fr: /authentification/i, es: /autenticaci/i, it: /autenticazione/i, pt: /autentica/i, ja: /認証/, zh: /认证/, ko: /인증/, he: /אימות/, ar: /مصادقة/, hi: /प्रमाणीकरण/ } },
  { what: 'a knowledge graph read as a chart', src: /\b(knowledge|identity|context|entity|semantic) graphs?\b/i,
    bad: { de: /diagramm|schaubild/i, nl: /diagram|grafiek/i, sv: /diagram/i, da: /diagram/i, fi: /kaavio|kuvaaja/i, fr: /diagramme|\bgraphique/i, es: /diagrama|gráfico/i,
           it: /diagramma|grafico/i, pt: /diagrama|gráfico/i, ja: /図表|チャート/, zh: /图表/, ko: /도표|차트/, he: /תרשים/, hi: /चार्ट|आरेख/ } },
  { what: 'a trading venue read as an event venue', src: /\bvenues?\b/i, onlyOn: ['exchanges', 'capital_markets_buyside', 'capital_markets_sellside', 'crypto_digital_assets'],
    bad: { de: /veranstaltung/i, nl: /evenement/i, fi: /tapahtumapaik/i, sv: /evenemang/i, da: /spillested|begivenhedssted/i, fr: /\bsalles?\b|lieux? d'événement/i, es: /recinto/i,
           pt: /recinto|local de evento/i, ja: /会場/, zh: /场馆|会场/, ko: /행사장|경기장/, he: /אולם/ } },
  { what: 'a clearing or market utility read as a software tool or a public utility', src: /\b(clearing|settlement|market|industry|shared) utilit/i,
    bad: { de: /dienstprogramm|versorgungs/i, nl: /hulpprogramma|nutsbedrijf/i, fr: /utilitaire/i, es: /utilidad/i, it: /utilità/i, pt: /utilitário|utilidade/i,
           sv: /verktyg|allmännytt/i, da: /værktøj|forsyning/i, fi: /apuohjelma|hyötyohjelma/i, zh: /实用程序|公用事业/ } },
  { what: 'healthcare quality measures read as actions taken', src: /\b(quality|HEDIS|Stars?|eCQM) measures?\b/i,
    bad: { de: /maßnahmen/i, nl: /maatregel/i, sv: /åtgärd/i, da: /foranstaltning/i, fi: /toimenpi/i, ja: /対策|措置/, zh: /措施/, ko: /조치/, he: /צעדי/, ar: /تدابير|إجراءات/, hi: /उपाय/ } },
  { what: 'a physical asset read as financial wealth', src: /\b(physical|fixed|field|plant|grid|network|installed|industrial|fleet) assets?\b|\basset (health|performance|integrity|maintenance|reliability|condition|registry|register|lifecycle|tracking|hierarchy|inspection)\b/i,
    except: /financial|digital assets?|asset managers?\b|wealth|portfolio|\bfunds?\b|investment|crypto|tokeni/i,
    bad: { nl: /vermogen/i, de: /vermögen/i, sv: /förmögenhet/i, da: /formue/i, fi: /varallisuu/i } },
  { what: 'a paper mill read as a windmill or a grain mill', src: /\bmills?\b/i, onlyOn: ['paper_packaging'],
    bad: { de: /mühle/i, nl: /molen/i, sv: /kvarn/i, da: /mølle/i, fi: /mylly/i, fr: /moulin/i, es: /molino/i, it: /mulino|macinazion/i, pt: /moinho/i,
           ja: /製粉|風車/, zh: /磨坊|风车|研磨/, ko: /제분|풍차/, he: /טחנ/, ar: /طاحون|مطحن/, hi: /चक्की/ } },
  { what: 'loan servicing read as maintenance', src: /\bservicing\b/i, except: /field servicing|equipment|aircraft|vehicle|asset servicing|engine|fleet/i,
    bad: { de: /wartung|instandhaltung/i, nl: /onderhoud/i, sv: /underhåll/i, da: /vedligehold/i, fi: /huolto/i, fr: /entretien|maintenance/i, es: /mantenimiento/i,
           it: /manutenzione/i, pt: /manutenção/i, ja: /保守|メンテナンス/, zh: /维护|保养/, ko: /유지보수|정비/, he: /תחזוק/, ar: /صيانة/, hi: /रखरखाव/ } },
  { what: 'a loan default read as a default setting', src: /\bdefaults?\b/i, onlyOn: ['banking', 'mortgage_lending', 'exchanges', 'construction'],
    except: /\bby default\b|\bdefaults? to\b|\bdefault (view|language|theme|shape|cloud|palette|settings?|values?|options?|region|site|quotas?|table format)\b/i,
    bad: { de: /standard/i, nl: /standaard/i, sv: /standard/i, da: /standard/i, fi: /oletus/i, fr: /par défaut|prédéfini/i, es: /predeterminad|por defecto/i,
           it: /predefinit/i, pt: /padrão|predefinid/i, he: /ברירת מחדל/, ko: /기본/, zh: /默认/, ar: /افتراضي/, hi: /डिफ़ॉल्ट सेटिंग/ } },
  { what: 'a loan workout read as exercise', src: /\bworkouts?\b/i, onlyOn: ['banking', 'mortgage_lending'],
    bad: { da: /træning/i, sv: /träning/i, nl: /training/i, de: /training/i, fi: /harjoitu/i, it: /allenament/i, pt: /treino/i, es: /entrenamiento/i, fr: /entraînement/i,
           he: /אימון/, ko: /운동/, ja: /トレーニング|運動/, zh: /锻炼|训练/, ar: /تمرين|تمارين/ } },
  { what: 'loan delinquency read as crime', src: /\bdelinquen/i,
    bad: { da: /kriminal/i, sv: /brottslig/i, nl: /criminal/i, de: /kriminal|straffällig/i, fi: /rikollis/i, it: /delinquenz|criminal/i, es: /delincuen/i, pt: /delinquênc|criminal/i,
           fr: /délinquan/i, he: /עבריינ|פשיע/, ko: /범죄|비행/, ja: /非行|犯罪/, zh: /犯罪|违法/, ar: /جنوح|إجرام/ } },
  { what: 'a foreclosure read as shielding or exclusion', src: /\bforeclos/i,
    bad: { da: /afskærm|udelukkelse/i, sv: /avskärm|utestäng/i, nl: /afscherm|uitsluiting/i, de: /abschirm|ausschluss/i, fi: /eristäm|poissulk/i, it: /preclusion|esclusion/i,
           es: /exclusión/i, pt: /exclusão/i, fr: /forclusion|exclusion/i } },
  { what: 'a paper grade read as a school mark, or dropped into a second quality', src: /\bgrades?\b/i, onlyOn: ['paper_packaging'], except: /upgrade|investment[- ]grade|food[- ]grade/i,
    bad: { sv: /betyg|\bgrade\b/i, da: /karakter|kvalitet\S* og kvalitet|kvalitets- og ai/i, he: /ציון|ציונים/, fi: /laatu ja laatu|laadukas ja laadukas|\bgrade\b/i,
           de: /qualität\S*\s+und\s+qualität|qualitäts-\s*und\s*qualität/i, nl: /kwaliteit\S*\s+en\s+kwaliteit/i } },
  { what: 'a cockpit screen read as an aircraft cockpit', src: /\bcockpits?\b/i,
    bad: { es: /cabina/i, pt: /cabine/i, it: /pilotaggio|\bcabina|pozzett/i, ko: /조종/, ar: /قمرة|طيّ?ار/, he: /טייס/, fi: /ohjaamo/i, ja: /操縦/, zh: /机舱/,
           fr: /poste de pilotage|\bcabine/i, de: /pilotenkanzel/i, nl: /stuurhut/i, sv: /förarhytt/i, da: /førerkabine/i, hi: /विमान/ } },
  { what: 'a claims title read as two nouns side by side', src: /^(VP )?Claims (?!and\b|&)[^.,;:!?]*$/,
    bad: { de: /^(VP )?(Versicherungsansprüche|Schadenfälle|Ansprüche) (?!und\b|&)\S|VP Insurance/i, fi: /^(VP )?(Vakuutuskorvaukset|Korvaukset) (?!ja\b|&)\S|^VP Vakuutuskorvaukset$/i,
           sv: /^(VP )?(Försäkrings(krav|anspråk|skador)|Anspråk) (?!och\b|&)\S|^VP Försäkrings/i, da: /^(VP )?(Forsikrings(krav|skader|sager)) (?!og\b|&)\S|^VP Forsikrings/i,
           nl: /^(VP )?(Verzekeringsclaims|Schadeclaims) (?!en\b|&)\S|^VP Verzekeringsclaims$/i, it: /VP Insurance/i } },
  { what: 'an insurance claim in Portuguese without its preposition', src: /\bclaims?\b/i, except: /claims? (that|to be)|(FDA[- ]cleared|marketing|label|product|ESG|green|patent|warranty) claims?/i,
    bad: { pt: { test: t => /^sinistros?\b/.test(t) || [...t.matchAll(/([A-Za-zÀ-ÿ&]+) sinistros?\b/g)].some(m => !/^(de|dos|das|do|da|os|as|o|e|ou|nem|aos|nos|nas|com|em|por|para|sobre|seus|suas|seu|sua|novos|mais|todos|cujos|quais|quantos|sem|entre|até|a|ao|à|pelos|pelas|como|que|esses|estes|dois|três|muitos|menos)$/i.test(m[1])) } } },
  { what: 'claims adjudication read as a court ruling, an arbitration or a tender award', src: /\badjudicat/i, except: /\b(dispute|court|tribunal|construction|contract award)\b/i,
    bad: { de: /rechtsprechung|\bgericht|\burteil|zuschlag/i, nl: /arbitrage|rechtspraak|berechting|gerecht|vonnis|toewijz/i, fr: /adjudication|arbitrag|\bjugé|ajust/i, it: /aggiudica/i,
           pt: /julgament|adjudica/i, es: /adjudica/i, sv: /domstol|rättskip|dömande|domslut/i, da: /domstol|retspleje|(?<!god)kendelse/i, fi: /tuomio|oikeudenk/i,
           ja: /判決/, ko: /판결|재판/, zh: /判决/, he: /פסק דין/, ar: /قضائ|(?<![\u0621-\u064A])(?:ال)?حكم(?![\u0621-\u064A])/ } },
  { what: 'a health claim adjudication read as property damage', src: /\badjudicat/i, onlyOn: ['health_insurance', 'pharmacy_pbm', 'healthcare', 'digital_health'],
    bad: { de: /schaden|schäden/i } },
  { what: 'an X & Y agent read as X, and an agent for Y', src: /^[^.]+ (&|and) [^.]+ Agent$/,
    bad: { fr: /\bet (l')?agent\b/i, it: /\be (l')?agente\b/i, pt: /\be (o )?agente\b/i, es: /\by (el )?agente\b/i, de: /\bund (KI-)?Agent/i, nl: /\ben (AI-)?agent\b/i,
           sv: /\boch (AI-)?agent\b/i, da: /\bog (AI-)?agent\b/i, fi: /\bja (tekoäly|AI-?)?agentti\b/i, he: /וסוכן/, ar: /ووكيل/ } },
  { what: 'contestability read as competitiveness or as controversial', src: /\bcontestab/i,
    bad: { da: /konkurrence/i, sv: /konkurrens|omstridd/i, de: /wettbewerb/i, nl: /concurrentie/i, fi: /kilpailu|kiistanalai/i, fr: /compétitiv|^revue contestable$/i,
           es: /competitiv/i, it: /competitiv/i, pt: /competitiv|^revisão contestável$/i, ja: /異議を唱えることができる/, ko: /논쟁의 여지/, he: /שנוי במחלוקת/, ar: /المراجعة القابلة للطعن/ } },
  { what: 'revenue assurance read as insurance', src: /\brevenue assurance\b/i,
    bad: { de: /versicherung/i, nl: /verzekering/i, sv: /försäkring/i, da: /forsikring/i, fi: /vakuutu/i, es: /seguro/i, it: /assicurazion/i, pt: /seguro/i,
           ja: /保険/, zh: /保险/, ko: /보험/, he: /ביטוח/, hi: /बीमा/ } },
  { what: 'an engagement read as a betrothal', src: /\bengagements?\b/i,
    bad: { de: /verlobung/i, nl: /verloving/i, sv: /förlovning/i, da: /forlovelse/i, fi: /kihla/i, fr: /fiançailles/i, es: /noviazgo|compromiso matrimonial/i, it: /fidanzament/i, pt: /noivado/i,
           ja: /婚約/, zh: /订婚/, ko: /약혼/, he: /אירוסין/, ar: /خطوبة/, hi: /सगाई/ } },
  { what: 'a consulting engagement read as involvement', src: /\bengagement (margin|burn|economics|profitability|P&L|staffing|delivery|health|knowledge|lifecycle|setup|managers?)\b|\bengagements? (are|is) (staffed|delivered|scoped|priced|billed)/i,
    onlyOn: ['professional_services', 'legal'],
    bad: { de: /beteiligung|engagement/i, nl: /betrokkenheid|engagement/i, sv: /engagemang/i, da: /engagement/i, fi: /sitoutum/i, fr: /implication|engagement/i, es: /compromiso|participación/i,
           it: /coinvolgimento/i, pt: /envolvimento|engajamento/i, ja: /エンゲージメント/, zh: /参与/, ko: /참여/, he: /מעורבות/ } },
  { what: 'corporate treasury read as the state treasury', src: /\btreasury\b/i, except: /\bUS Treasur|Treasury (bonds?|bills?|yields?|securities|notes?|auctions?)|T-bills?/i,
    bad: { de: /staatskasse|schatzamt/i, nl: /schatkist/i, sv: /statskassa/i, da: /statskasse/i, fi: /valtiokonttori/i, fr: /trésor public/i, es: /tesoro público|hacienda/i,
           it: /tesoro dello stato|ministero del tesoro/i, pt: /tesouro nacional/i, ja: /国庫|財務省/, zh: /国库|财政部/, ko: /국고|재무부/, he: /אוצר המדינה|משרד האוצר/, ar: /الخزانة العامة|وزارة الخزانة/, hi: /राजकोष/ } },
  { what: 'customer or staff attrition read as exhaustion or wear', src: /\battrition\b/i,
    bad: { de: /zermürb|abnutzung|erschöpf/i, nl: /uitputting|slijtage/i, sv: /utnötning|nötning/i, da: /udmattelse|slid\b/i, fi: /kulumi|näänty|uuvu/i, fr: /usure|épuisement/i,
           es: /desgaste/i, it: /logoramento|usura/i, pt: /desgaste/i, ja: /消耗|摩耗/, zh: /消耗|磨损/, ko: /소모|마모/, he: /שחיקה/, ar: /استنزاف/, hi: /घिसाव/ } },
  { what: 'header bidding translated word by word', src: /\bheader bidding\b/i,
    bad: Object.fromEntries(['de', 'nl', 'sv', 'da', 'fi', 'fr', 'es', 'it', 'pt'].map(l => [l, { test: t => !/header[- ]bidding/i.test(t) }])) },
  { what: 'pricing and packaging read as a physical package', src: /\b(pricing|price) (and|&) packaging\b|\bpackaging (and|&) pricing\b/i, notOn: ['paper_packaging'],
    bad: { de: /verpackung/i, nl: /verpakking/i, sv: /förpackning/i, da: /emballage|indpakning/i, fi: /pakkau/i, fr: /emballage/i, es: /embalaje|empaque/i,
           it: /imballag|confezion/i, pt: /embalage/i, ja: /包装|梱包/, zh: /包装/, ko: /포장/, he: /אריזה/, ar: /تغليف|التعبئة/ } },
  { what: 'a fleet of aircraft, turbines or vehicles read as a navy', src: /\bfleets?\b/i, except: /\b(ships?|vessels?|tankers?|navy|naval|maritime|marine|ocean)\b/i,
    notOn: ['shipping_ports'], bad: { fi: /(?<!lentokone|ilma-alusten |lentokoneiden )laivasto/i, ja: /艦隊/, ko: /함대/, zh: /舰队/ } },
  { what: 'a trial screen failure read as a display fault', src: /\bscreen[- ]fail/i,
    bad: { fi: /näyttövi|näytön (epäonnist|vi)/i, de: /bildschirm/i, nl: /scherm/i, sv: /skärm/i, da: /skærm/i, fr: /écran/i, es: /pantalla/i, it: /schermo/i, pt: /\btela\b/i,
           ja: /画面/, zh: /屏幕/, ko: /화면/, he: /מסך|הקרנ/, ar: /شاشة/ } },
  { what: 'a clinical site read as a website', src: /\bsites?\b/i, onlyOn: ['clinical_trials', 'pharmaceuticals', 'genomics_biotech'], except: /web ?sites?|SharePoint/i,
    bad: { fi: /sivusto/i, de: /webseite|website/i, nl: /website/i, sv: /webbplats/i, da: /websted|hjemmeside/i, fr: /site web/i, es: /sitio web/i, it: /sito web/i,
           zh: /网站/, ko: /웹사이트/, he: /אתר אינטרנט/, ar: /موقع (ويب|إلكتروني)/, hi: /वेबसाइट/ } },
  { what: 'market or retail intelligence read as espionage', src: /\b(market|retail|labou?r market|competitive|business|customer|location|pricing|supply|price|consumer|sales) intelligence\b/i,
    except: /threat intel|signals intelligence/i,
    bad: { fi: /tiedustelu/i, de: /spionage|geheimdienst|nachrichtendienst/i, nl: /inlichtingen|spionage/i, sv: /underrättelse|spionage/i, da: /efterretning|spionage/i,
           es: /espionaje/i, it: /spionaggio/i, pt: /espionagem/i, ja: /諜報|情報機関/, ko: /첩보/ } },
  { what: 'waste in fraud, waste and abuse read as garbage', src: /\bfraud,? waste\b|\bwaste,? (and|&) abuse\b/i,
    bad: { fi: /jäte/i, de: /abfall|müll/i, nl: /afval/i, sv: /avfall|sopor/i, da: /affald/i, fr: /déchet/i, es: /residuos|basura|desecho/i, it: /rifiut/i, pt: /resíduo|lixo/i,
           ja: /廃棄物|ごみ/, zh: /垃圾|废物/, ko: /폐기물|쓰레기/, he: /פסולת/, ar: /نفايات|مخلفات/, hi: /कचरा|अपशिष्ट/ } },
  { what: 'tax-loss harvesting read as felling trees or a crop harvest', src: /\btax[- ]loss harvest/i,
    bad: { sv: /avverkning|skörd/i, de: /ernte/i, nl: /oogst/i, da: /høst/i, fi: /sadonkorjuu|korjuu/i, he: /קציר/, hi: /फसल/ } },
  { what: 'identity resolution read as dissolving or screen resolution', src: /\b(identity|entity)[- ]resolution\b/i,
    bad: { sv: /upplösning/i, fi: /resoluutio/i, da: /opløsning/i, ja: /解像度/, zh: /分辨率/, ko: /해상도/, he: /רזולוציה/ } },
  { what: 'the drivers of a result read as device drivers or vehicle drivers',
    src: /\b(?:exogenous|contact|cost|churn|demand|value|margin|(?<!at-)risk|root[- ]cause|failure|delay|growth|price|pricing|revenue|key|performance|attrition|turnover|loss|claims?|yield|downtime|variance|velocity|volume|emissions?|spend|sales|lapse|readmission|utili[sz]ation|no-show|cancellation|satisfaction|engagement|consumption|uplift|profit|profitability|outcome|quality|scrap|defect)[- ]drivers?\b|\bdrivers? (?:of|behind)\b/i,
    except: /truck|delivery|bus\b|fleet|rideshare|ride-hail|JDBC|ODBC|device driver|driver[- ]app|driver (?:hours|safety|behaviou?r|scor)/i,
    bad: { sv: /drivrutin|förare/i, nl: /stuurprogramma|chauffeur/i, fi: /ajuri|kuljettaj|ohjai[mn]/i, fr: /\bpilotes?\b/i, es: /controlador/i, de: /\bfahrer/i, da: /drivprogram|chauffør/i,
           pt: /\bmotoristas?\b/i, it: /\bautist/i, ja: /運転手|運転者|連絡先ドライバー/, ko: /운전|연락처 드라이버/, zh: /驱动程序|司机/, he: /נהג|מנהלי ה?(?:קשר|התקשרות)/, ar: /سائق|برامج? تشغيل/ } },
  { what: 'work in flight read as air travel', src: /\bin[- ]flight\b/i,
    except: /in-flight (?:telemetry|entertainment|catering|service|connectivity|wi-?fi|sales|retail)|parameters\/sec in flight|(?:aircraft|planes?|drones?|UAVs?|satellites?|rockets?|missiles?|passengers?|cabin)\b[^.]{0,40}\bin[- ]flight/i,
    notOn: ['airlines', 'aerospace_space', 'travel_hospitality'],
    bad: { da: /flyvning/i, fi: /lennon aikana|lennossa|lennolla/i, he: /טיס/, it: /in volo\b/i, nl: /vlucht/i, sv: /flygning/i, de: /im flug\b/i, fr: /en vol\b/i,
           es: /en vuelo\b/i, pt: /em voo\b/i, ja: /飛行中|機内/, zh: /飞行中/, ko: /비행/, ar: /أثناء الطيران|الرحلة/, hi: /उड़ान/ } },
  { what: 'a decision call read as a phone call or an invitation', src: /\b(?:go\/no-go|judge?ment|tough|hard|final|right|risk) calls?\b|\bmake the call\b/i,
    bad: { da: /opfordring|opkald/i, fi: /kutsu|puhelu/i, nl: /oproep|telefoon/i, sv: /uppmaning|samtal/i, it: /chiamat/i, pt: /chamada/i, es: /llamada/i,
           fr: /\bappels?\b/i, de: /anruf|abfrage|aufruf/i, he: /קריא|שיחה/, ko: /요청|호출|통화/, ja: /コール|電話|呼び出し/, zh: /电话|呼叫|调用/, ar: /مكالم|استدعاء|نداء/, hi: /कॉल/ } },
  { what: 'core administration read as a system administrator', src: /\bcore admin\b/i,
    bad: { fi: /järjestelmänvalvoja|ylläpitäjä/i, de: /administrator/i, nl: /beheerder/i, sv: /administratör/i, da: /administrator/i, fr: /administrateur/i, es: /administrador/i,
           it: /amministratore/i, pt: /administrador/i, ja: /管理者/, zh: /管理员/, ko: /관리자/, he: /מנהל מערכת/, hi: /व्यवस्थापक/ } },
  { what: 'client onboarding read as founding a company', src: /\bonboarding\b/i,
    bad: { fi: /perustami/i, de: /gründung/i, nl: /oprichting/i, sv: /grundande|bildande/i, da: /stiftelse|grundlæggelse/i, fr: /fondation/i, es: /fundación/i, it: /fondazione/i, pt: /fundação/i } },
  { what: 'insurance claims read as demands or assertions', src: /\bclaims?\b/i,
    onlyOn: ['_common', 'insurance_pandc', 'life_insurance', 'health_insurance', 'healthcare', 'pharmacy_pbm', 'digital_health', 'medical_devices'],
    except: /claims? (that|to be)|(FDA[- ]cleared|marketing|label|product|ESG|green|patent|warranty) claims?/i,
    bad: { pt: /reivindica/i, es: /reivindic/i, fr: /revendication/i, it: /rivendicazion/i, de: /behauptung/i, nl: /bewering/i, sv: /påstående/i, da: /påstand/i,
           fi: /(?<!korvaus|vahinko|vakuutus)vaatimu(?!stenmukai|ksenmukai)|väite/i, ja: /主張/, zh: /主张|声明(?!式)/, ko: /주장/, he: /טענ/, ar: /ادعاء/ } },
  { what: 'a weighbridge scale read as a proportion', src: /\bscales?\b/i, onlyOn: ['waste_management', 'agriculture', 'mining'],
    except: /at scale|scale[ -](up|out)|scalab|large[- ]scale|economies of scale|to scale|scales? (with|across)/i,
    bad: { fi: /mittakaava/i, de: /maßstab/i, nl: /schaal/i, sv: /skala/i, da: /skala/i, fr: /échelle/i, es: /escala/i, it: /\bscala/i, pt: /escala/i, ja: /規模|スケール(?!ハウス)/, zh: /规模|比例/, ko: /규모|스케일/ } },
  { what: 'an industrial plant read as a building or property', src: /\b(?<!SAP )plants?\b/i,
    except: /\b(crops?|seeds?|breed\w*|agronom\w*|planting|germplasm|nurser(y|ies)|greenhouses?|horticult\w*|facilit(y|ies)|estates?)\b/i,
    bad: { fi: /kiinteistö/i, it: /struttura/i } },
  { what: 'an IT or physical estate read as real property or an inheritance', src: /(?<!\breal[- ])\bestates?\b/i,
    except: /real[- ]estate|estate planning|estate tax|estates? (and|&) trusts?|probate|\bpropert(y|ies)\b/i,
    bad: { fi: /kiinteist/i, de: /anwesen|immobilie|nachlass/i, nl: /landgoed|nalatenschap|onroerend/i, sv: /fastighet|\bgods\b|dödsbo/i, da: /ejendom|\bgods\b|dødsbo/i,
           fr: /\bdomaine|succession|propriété/i, es: /finca|hacienda|(?<!ad)herencia/i, it: /tenuta|patrimonio|eredit/i, pt: /propriedade|herança|espólio|patrimôni/i, ja: /不動産|地所|屋敷|遺産/,
           zh: /庄园|房产|遗产|地产/, ko: /부동산|사유지|유산/, he: /אחוז|נדל"ן|עיזבון/, ar: /عقار|ضيعة|(?<!مش)تركة/, hi: /जायदाद/ } },
  { what: 'an insurance policy read as a rule or a government policy', src: /\bpolic(y|ies)\b/i, onlyOn: ['insurance_pandc', 'life_insurance', 'health_insurance'],
    except: /(Unity Catalog|ABAC|access|masking|row[- ]filter|governance|retention|security|data|tag|cluster|budget|compute|serverless|pricing|monetary|public|foreign|credit|underwriting|investment|privacy|return|refund|cancellation|company|internal|IAM) polic|polic(y|ies) (engine|rules?|as code|enforcement|tags?)|policy rates?/i,
    bad: { de: /richtlinie|politik/i, nl: /beleid/i, sv: /riktlinje|politik/i, da: /politik|retningslinje/i, fi: /käytäntö|politiik|toimintaperiaat/i, fr: /politique/i, es: /política/i,
           it: /politic|criteri/i, pt: /política/i, ja: /方針|政策/, zh: /政策|策略|方针/, ko: /정책/, he: /מדיניות/, ar: /سياسة|سياسات/, hi: /नीति/ } },
  { what: 'a party in a record read as a political or a social party', src: /(?<!third )(?<!third-)\bpart(y|ies)\b(?![- ](to|of)\b)/i,
    onlyOn: ['_common', 'legal', 'life_insurance', 'insurance_pandc', 'health_insurance', 'payments_fintech', 'banking', 'mortgage_lending', 'wealth_management', 'capital_markets_buyside', 'capital_markets_sellside', 'crypto_digital_assets'],
    except: /third[- ]part|political|birthday|party size|dinner party|search party|working party/i,
    bad: { ja: /政党|党派|パーティー/, zh: /政党|党派|派对/, ko: /정당|파티/, fr: /\bpartis?\b/i, es: /\bpartidos?\b/i, it: /\bpartit[oi]\b/i, pt: /\bpartidos?\b/i, sv: /\bparti\b|\bpartier\b/i,
           da: /\bparti\b|\bpartier\b/i, fi: /puolue/i, he: /מפלג/, ar: /حزب|أحزاب/ } },
  { what: 'a payment or trade settlement read as a village or a colony', src: /\bsettlements?\b/i,
    except: /dispute settlement|claims? settlement|legal|lawsuit|litigation|class action|human settlement|informal settlement|settlement agreement|out-of-court/i,
    bad: { sv: /bosättning|bebyggelse/i, da: /bosættelse|bebyggelse/i, de: /siedlung/i, nl: /nederzetting/i, fi: /asutu|siirtokun|asuinalue/i, it: /insediament/i, es: /asentamiento/i,
           pt: /assentamento|povoado/i, fr: /colonie|peuplement/i, ja: /入植|集落/, zh: /定居|聚落/, ko: /정착지|정착촌/, he: /התנחל|יישוב(?! סכסוכ)/, ar: /مستوطن/, hi: /बस्ती/ } },
  { what: 'grounding an aircraft or a vehicle read as electrical grounding', src: /\bground(s|ed|ing)? (a|an|the|its) (vehicle|aircraft|plane|jet|tail)\b|\bgrounded (aircraft|fleet|tails?|vehicles?)\b/i,
    bad: { fi: /maadoit/i, de: /erdet|erdung|geerdet/i, nl: /geaard|aarding/i, sv: /jordad|jordning/i, da: /jordforbund|jordet/i, fr: /mise à la terre/i, es: /puesta a tierra|conectad\w* a tierra/i,
           it: /messa a terra/i, pt: /aterrad|aterramento/i, ja: /接地/, zh: /接地/, ko: /접지/, he: /הארק/, ar: /تأريض/, hi: /अर्थिंग/ } },
  { what: 'to surface a finding read as the ground surface', src: /\bsurfac(e|es|ed|ing)\b/i, except: /surface (water|mining|area|temperature|finish|defects?|treatment|mount|coat|fleet|operations?|equipment|mines?|crews?)|underground and surface|road surface|airport surface|sea surface|ground surface/i,
    bad: { ja: /地表/, zh: /地表/, ko: /지표면/ } },
  { what: 'a model surfacing a finding read as a surface', src: /\b(?:and|to|models?|agents?|apps?|that|which|they|will|can|Genie|Serving|MLflow|AI\/BI) surfaces? (?=[a-z])/,
    except: /attack surface|underground and surface|surface fleet|agent surfaces they|surfaces? (?:water|area|temperature|finish|defects?|treatment|mount|coat)/i,
    bad: { de: /(?<!benutzer|bedien)oberfläche/i, nl: /oppervlak/i, sv: /\byt(?:an|or)?\b/i, da: /overflade/i, fi: /(?<!raja)pin(?:na|ta)/i, es: /superficie/i, it: /superficie/i,
           pt: /superfície/i, fr: /\bsurfaces?\b/i, he: /משטח/, hi: /सतह/, ar: /سطح/ } },
  { what: 'a product surface read as a physical surface', src: /\bon one surface\b|\b(?:developer|API|agent|coding|provisioned|separate|each) surfaces?\b|\bthe surfaces? (?:covers|that deliver|that put)\b/i,
    bad: { nl: /oppervlak/i, sv: /\byt(?:an|or)?\b/i, da: /overflade/i, fi: /(?<!raja)pin(?:na|ta)/i, es: /superficie/i, it: /superficie/i, pt: /superfície/i,
           fr: /\bsurfaces?\b/i, he: /משטח/, hi: /सतह/, ar: /سطح/, ja: /表面/, zh: /表面/, ko: /표면/ } },
  { what: 'lot genealogy read as family history', src: /\bgenealog/i,
    bad: { sv: /släktforsk/i, da: /slægtsforsk/i, nl: /stamboom/i, fi: /sukututkim/i, de: /ahnenforsch|familienforsch/i, he: /אילן יוחסין|חקר משפח/ } },
  { what: 'product giveaway read as a gift', src: /\bgiveaway/i,
    bad: { de: /geschenk/i, fr: /cadeau/i, es: /regalo|obsequio/i, it: /omaggi|regal/i, pt: /brinde|presente/i, nl: /cadeau|weggeef/i, sv: /\bgåv/i, da: /\bgave/i,
           fi: /lahja/i, ja: /プレゼント|景品|贈/, zh: /赠/, ko: /경품|증정|선물/, he: /מתנה|מתנות/, ar: /هدي|هبة/, hi: /उपहार/ } },
  { what: 'a crack spread read as a fissure', src: /\bcrack[- ]spread/i,
    bad: { zh: /裂缝|裂纹/, ko: /균열/, ja: /亀裂|ひび/, fr: /fissure/i, es: /grieta/i, it: /crepa|incrin/i, pt: /rachadura|fissura/i, de: /\briss/i, nl: /scheur/i,
           sv: /spricka/i, da: /revne/i, fi: /halkeam|särö/i, he: /סדק/, ar: /شق|تصدع/, hi: /दरार/ } },
  { what: 'a lift read as an elevator', src: /\blift(?:s|ing|ings)?\b/i, except: /\belevators?\b|ski lift|chairlift/i,
    bad: { fr: /ascenseur/i, es: /ascensor/i, it: /ascensor/i, pt: /elevador/i, de: /aufzug|fahrstuhl/i, sv: /\bhiss/i, da: /elevator/i, fi: /hissi/i,
           zh: /电梯/, ko: /엘리베이터/, ja: /エレベーター/, he: /מעלית/, ar: /مصعد/, hi: /एलिवेटर/ } },
  { what: 'a fuel loading rack read as shelving', src: /\bracks?\b/i, onlyOn: ['oil_gas_downstream_refining', 'oil_gas_midstream'],
    bad: { it: /scaffal/i, de: /\bregal/i, fr: /étagère|rayonnage/i, es: /estanter/i, pt: /prateleir|estante/i, nl: /\bschap/i, sv: /\bhyll/i, da: /\breol|hylde/i,
           fi: /\bhylly/i, ja: /棚/, zh: /货架|架子/, ko: /선반/, he: /מדף/, ar: /رفوف/ } },
  { what: 'a cargo lifting read as raising', src: /\blift(?:s|ing|ings)?\b/i, onlyOn: ['oil_gas_downstream_refining', 'oil_gas_midstream'],
    bad: { zh: /提升/, ko: /리프트/, ja: /リフト/ } },
  { what: 'tribal knowledge read as a tribe', src: /\btribal (?:knowledge|memory)\b/i,
    bad: { de: /stammes/i, nl: /\bstam/i, sv: /\bstam/i, da: /stamme/i, fi: /heimo/i, fr: /tribal/i, es: /tribal/i, it: /tribal/i, pt: /tribal/i,
           ja: /部族/, zh: /部落/, ko: /부족/, he: /שבט/, ar: /قبيل|قبلي/, hi: /जनजात|आदिवास|कबील/ } },
  { what: 'machine vision read as eyesight or an aspiration', src: /(?<!\b(?:Machine|Computer) )\bVision(?=\/ML\b| & )/,
    bad: { ko: /시력/, he: /חזון/, de: /\bSicht\b/, nl: /\bvisie\b/i, sv: /\bsyn\b/i, da: /\bsyn\b/i, fi: /\bnäkö\b|visio\b/i, zh: /视力|愿景/, ja: /視力|(?<!マシン ?)ビジョン/ } },
  { what: 'the products teams rely on read as driving or running', src: /^Contracted products .+ run on:/,
    bad: { fi: /\bajavat\b|jatkuvat|juoks/i, sv: /\bkör på\b/i, da: /\bkører på\b/i, nl: /\bdraaien\b/i, he: /פועל(?:ים|ות) על/, ko: /추구|^[^:]*에 의존하는/ } },
  { what: 'power generation read as a generation of people', src: /(?<![-\w])generation\b/i,
    onlyOn: ['electric_power_generation', 'renewables', 'electric_utility'], except: /route generation|work-order generation|next generation/i,
    bad: { fi: /sukupolv/i, ja: /世代/, zh: /世代|代人/, ko: /세대/, he: /\bדור\b|דורות/, ar: /\bجيل|أجيال/, hi: /पीढ़ी/, nl: /generatie/i } },
  { what: 'data served read as food served', src: /\bserved\b/i, except: /food|meals?|(customers?|patients?|members?) served|served (area|market)|communit/i,
    bad: { fi: /tarjoil/i, ja: /盛り付/, zh: /端上/ } },
  { what: 'an installed base read as a basic service', src: /\binstalled base\b/i, bad: { fi: /peruspalvelu/i } },
  { what: 'trade spend read as consumption in shops', src: /\btrade spend\b/i, bad: { fi: /kulutus/i } },
  { what: 'the next best action read as the second best', src: /\bnext[- ]best\b/i,
    bad: { ja: /次善/, ko: /차선/, de: /nächstbest|nächste[nrs]? beste[nrs]?\b/i, sv: /näst bäst/i, da: /næst-?bedst|næste-bedste/i, fi: /toiseksi parh|seuraavaksi parh/i } },
  { what: 'data marts read as markets or the month of March', src: /(?<![\w-])marts?\b/i, except: /\bmarkets?\b|marketplace|Walmart|Kmart/i,
    bad: { de: /märkte|\bmarkt\b|-markt\b/i, nl: /\bmarkt(en)?\b|markten\b/i, fr: /\bmarchés?\b/i, es: /\bmercados?\b/i, pt: /\bmercados?\b/i, it: /\bmercat[io]\b/i,
           sv: /\bmars\b|marknad/i, da: /(?<!data ?)\bmarts\b|markeder/i, fi: /datakaup|tietokaup|\bkaupat\b|markkin(?!oint)|[a-zäöå]pistee/i, he: /מרץ|מרס/,
           ar: /أسواق|سوق/, hi: /बाज़ार|बाजार/, ja: /市場/, ko: /시장/, zh: /市场/ } },
  { what: 'GB-scale read as British', src: /\bGB[- ]scale\b/i,
    bad: { de: /britisch/i, it: /britannic|ingles/i, fi: /englann|britann/i, fr: /britanni/i, es: /británic/i, pt: /britânic/i, nl: /\bbrits/i, sv: /brittisk/i, da: /britisk/i,
           ja: /英国|イギリス/, ko: /영국/, zh: /英国/, ar: /بريطان/, he: /בריט/, hi: /ब्रिटेन|ब्रिटिश/ } },
  { what: 'a loan cure rate read as healing, hardening, recovery or an exchange rate', src: /\bcure rates?\b/i,
    bad: { de: /heilung/i, nl: /genezing|curate/i, it: /guarigion/i, sv: /härdning|kurering/i, da: /kurshastighed/i, fi: /parantum|kovettum/i, he: /ריפוי/, ar: /الشفاء|التعافي/,
           ja: /治癒/, ko: /치료/, es: /recuperaci|curaci/i } },
  { what: 'a delinquency roll rate read as rolling, sliding or a rollover', src: /\broll rates?\b/i,
    bad: { nl: /rolsnelheid/i, it: /rollio/i, sv: /rullhastighet|rullningstakt/i, da: /rullehastighed/i, fi: /kiertymis/i, he: /גליל|גלישה/, ar: /التدحرج/, ko: /롤 이자율|롤 금리/, pt: /rolagem/i } },
  { what: 'broadcast programming read as writing code', src: /\bprogramming\b/i, onlyOn: ['media_broadcasting'],
    bad: { de: /programmier/i, sv: /programmering/i, da: /programmering/i, fi: /ohjelmoin/i, nl: /programmeren/i, ja: /プログラミング/, ko: /프로그래밍/, zh: /编程/, he: /תכנות/, ar: /البرمجة/ } },
  { what: 'an insurance reserve read as a spare or a preliminary', src: /\breserv(e|es)\b/i, onlyOn: ['insurance_pandc', 'life_insurance', 'health_insurance'],
    bad: { ja: /予備/, ko: /예비/ } },
  { what: 'a programming slate read as stone or a writing slate', src: /\bslate\b/i, onlyOn: ['media_broadcasting'],
    bad: { fr: /ardoise/i, es: /pizarra/i, it: /ardesia/i, pt: /ardósia/i, nl: /leisteen/i, da: /skifer/i, sv: /skiffer/i, de: /schiefer/i, fi: /liuske/i, he: /צפחה/, zh: /板岩/, ar: /لائحة/ } },
  { what: 'a ratio read as a price', src: /^(?![\s\S]*\b(take|bill|billing|billable|effective|freight|interchange|discount|interest|exchange|FX|tax|spot|day|daily|hourly|labou?r|net effective|room|ad|CPM|base|shipping|tariff|price|pricing|premium|commission|fee|pay|wage|policy|mortgage|swap|coupon|forward|repo|funding|lending|deposit|savings|loan|card|reimbursement|contract|negotiated|charge|cost)\b)[\w&/ -]{0,40}\brate$/i,
    bad: { de: /\btarif/i, it: /\btariff/i, es: /\btarifa/i, pt: /\btarifa/i, fr: /\btarif/i, nl: /\btarie/i, sv: /\btariff/i, da: /\btarif/i, fi: /\btariffi/i } },
  { what: 'a crude slate and blend read as the same word twice', src: /^Crude slate & blend$/i,
    bad: Object.fromEntries(LANGS.map(l => [l, { test: t => /(\p{L}{4,})[\s\S]*\1/iu.test(t) || /(\p{Script=Han}{2})[\s\S]*\1/u.test(t) }])) },
  { what: 'the loss-mitigation abbreviation read as the word with', src: /\bLoss Mit\b/,
    bad: { it: /perdita con/i, pt: /perda mit/i, nl: /verlies mit/i, ko: /미트/, ja: /ミット/, es: /pérdida con/i, fr: /perte avec/i, de: /verlust mit/i, sv: /förlust med/i, da: /tab med/i } },
  { what: 'a quality command centre read as an order or a software command', src: /\bquality command\b/i,
    bad: { de: /befehl/i, ko: /명령/, ja: /コマンド/, nl: /commando/i, sv: /kvalitetskommando/i, da: /kvalitetskommando/i, fi: /laatu komento|laatukomento/i, he: /פיקוד/ } },
  { what: 'a trust and compliance team read as orders to trust and comply', src: /\bTrust & Comply\b/,
    bad: { pt: /confie|cumpra/i, nl: /vertrouw en voldoe/i, it: /fidati|rispetta\b/i, sv: /lita på/i, da: /overhold\b/i, fi: /luota|noudata/i } },
  { what: 'an insurance benefit read as an advantage or a perk', src: /\bbenefit payouts?\b/i, onlyOn: ['life_insurance', 'insurance_pandc', 'health_insurance'],
    bad: { nl: /voordeel/i, ko: /혜택/, he: /הטב/ } },
  ...['Banner', 'Canvas', 'Slate'].map(name => ({ what: `the education system ${name} translated`, src: new RegExp('\\b' + name + '\\b'), onlyOn: ['education'],
    bad: Object.fromEntries(LANGS.map(l => [l, { test: t => !t.includes(name) }])) })),
  { what: 'an AI model read as a fashion or product model', src: /\bmodels?\b/i,
    except: /\b(?:vehicles?|cars?|aircraft|engines?|devices?|phones?|handsets?|tractors?|equipment|trucks?|turbines?|meters?|products?|SKUs?|bikes?|boats?|appliances?|printers?)\s+models?\b|\bmodel[- ](?:years?|lines?|ranges?|numbers?|mix)\b/i,
    bad: { he: heWord('(?:[ובלהשכ]{0,3}|[ושכ]{0,2}מה)דג(?:ם|מים|מי)'), zh: /型号/, ar: /الطراز|طراز|الطرز|طرز/ } },
  { what: 'data modellers read as fashion models', src: /\bmodell?(?:ers?|ing)\b/i, bad: { he: /דוגמנ/ } },
  { what: 'versioned data read as drafted or corrected text', src: /\bversioned\b/i, bad: { he: heWord('[ובלהשכ]{0,2}(?:מנוסח|מתוקן|מתוקנ)(?:ת|ים|ות)?') } },
  { what: 'engineered features read as planned or programmed', src: /\bfeatures? (?:are |is )?engineered\b|\bengineered (?:in|on) Feature Store\b/i,
    bad: { he: heWord('[ובלהשכ]{0,2}מתוכנ(?:ן|נת|נים|נות)') } },
  { what: 'trading positions read as stances', src: /\bpositions?\b/i, except: /competitive position|regulatory positions/i, onlyOn: FIN_FILES,
    bad: { he: heWord('(?:[ובלהשכ]{0,3}|[ושכ]{0,2}מה)עמד(?:ה|ות|ת)') } },
  { what: 'replaying a record read as playing back media', src: /\breplay(?:ed|able)?\b/i, bad: { he: /להשמעה|מושמע|הושמע/ } },
  { what: 'a security master read as security or protection', src: /\bsecurity masters?\b/i,
    bad: { de: /sicherheits/i, fr: /sécurité/i, es: /seguridad/i, pt: /segurança/i, it: /sicurezza/i, nl: /beveiliging/i, sv: /säkerhet/i, da: /sikkerhed/i, fi: /turvallisuu|tietoturv/i,
           ja: /セキュリティ/, zh: /安全/, ko: /보안/, ar: /أمن|الأمان/, hi: /सुरक्षा/, he: /אבטח/ } },
  { what: 'financial instruments read as tools, apparatus or musical instruments', src: /\binstruments?\b/i, onlyOn: FIN_FILES.filter(f => f !== '_common'), except: /musical|measuring|\blab\b/i,
    bad: { he: new RegExp('כלי נגינה|' + heWord('[ובלהשכ]{0,3}כלים?').source), ja: /楽器|器具/, zh: /乐器|仪器/, ko: /악기|기기/, fi: /soitin|soittimi/i } },
  { what: 'trading or loan books read as books to read', src: /(?<!order )(?<!e-)\bbooks\b/i, onlyOn: ['exchanges', 'capital_markets_buyside', 'capital_markets_sellside', 'crypto_digital_assets', 'wealth_management', 'banking'],
    except: /bookkeeping|books? value|books?[- ](?:and|&)[- ]records|clos(?:e|es|ed|ing) (?:the|its|their) books/i,
    bad: { he: heWord('[ובלהשכ]{0,3}ספרים'), ja: /書籍|(?<!取引)本(?!番|部|社|格|来|質|日)/, zh: /书籍|图书/, ko: /도서|책/, hi: /किताब|पुस्तक/, fi: /kirjoja|kirjat/i } },
  { what: 'Unity Catalog grants read as subsidies', src: /\b(?:Unity Catalog|UC|SQL|table|catalog|schema|access|privilege|permission)s? grants\b|\b(?:the|its|their|same) grants\b|\bsecurables?\b/i,
    except: /research grant|federal grant|grantee|scholarship|endowment/i,
    bad: { de: /zuschüss|stipendi|fördermittel/i, fr: /subvention/i, es: /subvenci/i, pt: /subsídio|bolsa/i, it: /sovvenzion|garantibil/i, nl: /subsidie/i, sv: /bidrag/i, da: /tilskud/i,
           fi: /avustu/i, ja: /助成金|補助金/, zh: /拨款|补助/, ko: /보조금/, ar: /منح/, hi: /अनुदान/, he: /מענק/ } },
  { what: 'a call, case or query resolution read as dissolving or screen resolution', src: /\b(?:case|query|call|ticket|311|contact|complaint|dispute)[- ]resolution\b|\bresolution (?:data|time|rates?)\b|Auto-Resolution|\bdrivers and resolution\b/i,
    bad: { he: /רזולוציה/, sv: /upplösning/i, da: /opløsning/i, fi: /resoluutio|erottelukyk/i, de: /auflösung/i, nl: /resolutie/i, ja: /解像度/, zh: /分辨率/, ko: /해상도/ } },
  { what: 'a variant call or basecall read as a phone call', src: /\bvariant call|\bbasecall/i,
    bad: { he: /שיח/, sv: /samtal/i, da: /opkald/i, fi: /puhelu/i, de: /anruf/i, ja: /電話/, zh: /电话/, ko: /통화/, ar: /مكالم/ } },
  { what: 'a caller identity read as a phone caller', src: /\bcallers?\b/i, except: /phone|call[- ]cent|contact[- ]cent|\bIVR\b|caller ID|911|emergency/i, bad: { he: /מתקשר/ } },
  { what: 'typed records read as keyboard typing', src: /\btyped\b/i, bad: { he: /מוקלד|הוקלד|הקלד/ } },
  { what: 'presentation slides read as playground slides', src: /\bslides\b/i, bad: { he: /מגלש/ } },
  { what: 'a margin call read as page margins', src: /\bmargin calls?\b/i, bad: { he: /שוליים/ } },
  { what: 'manufacturing yield read as an investment return', src: /\byield(?:s|ing)?\b(?! (?:curve|spread|to maturity|enhancement|farming))/i,
    except: /dividend|\bROI\b|yield curve|bond|coupon|treasur|investment yield|portfolio yield|rental yield|crop|harvest|\bacre|hectare|agronom|grain|seed/i, onlyOn: MFG_FILES,
    bad: { sv: /avkastning/i, fi: /tuotto(?!is)|tuoto(?!s|k)/i, he: /תשוא/, de: /rendite/i, ja: /利回り/, zh: /收益率/, ko: /수익률/, da: /afkast/i } },
  { what: 'a chip fab read as fabulous', src: /\bfabs?\b/i,
    bad: { sv: /fantastisk|fabulös|underbar/i, da: /fabelagtig|fantastisk/i, fi: /upea|mahtava|fantastinen|satumai/i, de: /fabelhaft|fantastisch|\btoll/i, fr: /fabuleu|fantastique/i,
           es: /fabulos|fantástic/i, it: /favolos|fantastic/i, pt: /fabulos|fantástic/i, nl: /fabelachtig|fantastisch|geweldig/i, he: /מדהים|נהדר|אגדי|נפלא|אגדות/, ar: /رائع|خرافي|مذهل/ } },
  { what: 'a process excursion read as a trip', src: /\bexcursions?\b/i,
    bad: { he: /טיול|סיור/, ar: /رحل|نزه/, fr: /randonn|voyage/i, es: /paseo|viaje/i, it: /\bgit[ae]\b/i, pt: /passeio|viagem/i, de: /ausflug/i, nl: /uitstap/i, sv: /utflykt/i,
           da: /udflugt/i, fi: /retki/i, ja: /遠足|旅行/, zh: /远足|旅行|游览/, ko: /소풍|여행|견학/, hi: /भ्रमण|यात्रा|सैर/ } },
  { what: 'remaining useful life read as the rest of a life', src: /\bremaining[- ](?:useful[- ])?life\b|\bRUL\b/i,
    bad: { he: /בחיים|שארית חיים|שאר החיים|השארת חיים|שנותרי החיים|שנותר[- ]חיים|שנותרו-שימושי|מודלים שימושיים שנותרו|שנותרו שימושיים/ } },
  { what: 'a generating fleet read as vehicles', src: /\bfleets?\b/i, onlyOn: ['renewables', 'electric_power_generation'], bad: { ja: /車両/, ko: /차량/, zh: /车队|车辆/ } },
  { what: 'a profit margin read as a trading deposit', src: /\bmargins?\b/i, notOn: ['exchanges', 'capital_markets_buyside', 'capital_markets_sellside', 'crypto_digital_assets'],
    except: /margin calls?|(?:initial|variation|interest) margin|margin (?:usage|limits?|state|files?|requirements?|ledger|lending|accounts?)|prime brok|collateral|clear(?:ing|ed)|novated|off-margin|margin (?:and|&) (?:financing|collateral|settlement|default)/i,
    bad: { ja: /証拠金/, zh: /保证金/, ko: /증거금/ } },
  { what: 'a work, airport or compressor station read as a railway station', src: /\bstations?\b/i,
    onlyOn: ['airlines', 'oil_gas_midstream', 'public_safety', 'aerospace_space', 'automotive', 'manufacturing', 'medical_devices', 'machinery', 'computer_electronics'],
    except: /\b(?:ground|space|base|charging|weather|radio|gas|fuel|power|pump(?:ing)?|lift|train|rail|metro) stations?\b|police/i,
    bad: { ja: /駅|路線/, zh: /车站/, ko: /(?<![가-힣])역(?:별|에|과|,| )|노선/, de: /bahnh/i, fr: /\bgares?\b/i } },
  { what: 'a process or generating unit read as a unit of measure', src: /(?<![-\w])(?<!per )units?\b(?! of\b)/i, except: /per unit|unit of/i,
    onlyOn: ['oil_gas_downstream_refining', 'chemical_mfg', 'renewables', 'electric_power_generation'], bad: { ja: /(?<!原)単位/, zh: /单位/, ko: /단위/ } },
  { what: 'shipping an app read as sending freight', src: /^Ship (?:the|its|their|your)\b/, except: /shipments?|shipping/i,
    bad: { de: /^(?:Versenden|Vermitteln)\b/, pt: /^Envie\b/, it: /^Spedisci\b/, nl: /^(?:Verzend|Verstuur|Stuur|Ship)\b/, sv: /^(?:Skicka|Ship)\b/, da: /^Send\b/, fi: /^(?:Lähetä|Toimita)\b/,
           ja: /出荷/, he: /^שלח\b/, fr: /^Expédiez\b/, es: /^Envíe\b/, hi: /जहाज/, zh: /船舶|发货/, ko: /배송|발송/ } },
  { what: 'operational dispatch read as shipping goods', src: /(?<![-\w])dispatch(?:es)?\b(?!-)/i, onlyOn: DISPATCH_FILES,
    except: /dispatch advices?|dispatch to distribution points|relief[- ]items?|parcels?|ship-from|shipments?|freight|waybills?|cargo|deliver/i,
    bad: { de: /versand|versend/i, ja: /発送|出荷/, zh: /发货|发运|运送/, ko: /발송|배송/, fr: /expédi/i, es: /envío/i, it: /spedizion/i, nl: /verzend/i, sv: /frakt|försändelse/i,
           da: /forsendelse|afsendelse/i, fi: /lähetys|lähettäm/i, pt: /expedição|\benvio/i, he: /משלוח/, ar: /شحن/, hi: /शिपमेंट/ } },
  { what: 'a test bin read as a container or a waste bin', src: /(?<![-\w])bins?\b/i, onlyOn: ['semiconductors', 'computer_electronics'],
    except: /\b(?:trash|waste|recycling|storage|parts|wheelie|litter) bins?\b/i,
    bad: { de: /behälter|tonne|mülleimer|kiste|abfall/i, sv: /behållare|soptunn|papperskorg|\blår|\blåd(?:a|or)\b|kärl/i, fi: /säiliö|roskakori|roskis|astia|laatik/i, it: /contenitor|cestin|bidon|secchio/i,
           nl: /\bbak(?:ken)?\b|container|prullenbak|vuilnisbak|afvalbak/i, da: /beholder|skraldespand|spand|kasse|affald/i, fr: /\bbacs?\b|poubelle|corbeille/i, es: /contenedor|papelera|basura|\bcubos?\b/i,
           pt: /lixeira|lixo|caixa|recipiente|contentor/i, he: new RegExp(heWord('פח').source + '|מיכל|' + heWord('סל').source), ar: /سلة|صندوق|حاوية|سلال(?!ة)/, zh: /垃圾|箱/, ko: /쓰레기|상자|휴지통/, ja: /ゴミ|箱/ } },
  { what: 'a production lot read as a plot of land or as "a lot of"', src: /(?<![-\w])lots?\b/i, onlyOn: LOT_FILES, except: /\ba (?:whole )?lot\b|parking lots?|lots of|tax lots?/i,
    bad: { he: /מגרש|חלקה|המון/, ko: /부지|주차/, nl: /perceel|kavel/i, sv: /tomt/i, fi: /tontti/i, de: /grundstück|parzelle/i, ar: /قطعة أرض/, hi: /भूखंड/, da: /(?<!på )\bgrund(?![a-zæøå])/i } },
  { what: 'a circuit board read as a board of directors', src: /(?<![-\w])boards?\b/i, onlyOn: ['computer_electronics'],
    except: /board of directors|the board (?:reads|approves|sees|asks)|board packs?|board[- ]level reporting|(?:CFO|CEO|executive|audit) (?:and )?(?:the )?board|board and (?:the )?(?:regulators?|auditors?|investors?)|board meetings?|quarterly board/i,
    bad: { sv: /styrelse/i, da: /bestyrelse/i, zh: /董事会/, ar: /مجلس/, de: /vorstand|aufsichtsrat|gremium/i, fr: /conseil/i, es: /junta|directorio|consejo/i, pt: /conselho|diretoria/i,
           nl: /bestuur|raad van/i, ja: /取締役会|役員会/, ko: /이사회/, he: /דירקטוריון|ועד/, fi: /hallitu|johtokun/i, it: /consiglio/i, hi: /निदेशक/ } },
  { what: 'a quality disposition read as disposal or temperament', src: /\bdisposition/i, onlyOn: LOT_FILES,
    bad: { ja: /処分|傾向|気質/, ko: /처분|성향|기질/, he: /נטייה|סילוק|השלכה/, fi: /hävit|luonne|taipumus|loppusijoitus/i, it: /smaltiment|predisposizione|indole/i, ar: /التخلص|الميل|مزاج|نزعة/,
           de: /entsorgung|veranlagung|neigung/i, fr: /élimination|tempérament|mise au rebut/i, hi: /निपटान|स्वभाव|प्रवृत्ति/, es: /eliminación|temperamento/i, pt: /descarte|temperamento|eliminação/i,
           nl: /verwijdering|\baanleg|neiging|afgevoerd/i, sv: /kassering|benägenhet/i, da: /bortskaffelse|tilbøjelighed|gemyt/i, zh: /倾向|性情|丢弃/ } },
  { what: 'a lab reagent read as a respondent', src: /\breagents?\b/i, bad: { he: /מגיב/ } },
  { what: 'a sequencing instrument read as a sequence', src: /\bsequencers?\b/i, except: /\bsequences?\b/i, bad: { he: /רצף/ } },
  { what: 'team leads read as sales leads or referrals', src: /\bLeads?\b/, notOn: SALES_LEAD_FILES, except: /sales|marketing|CRM|prospect|lead[- ]?time|lead[- ]gen|zinc/i,
    bad: { he: /לידים|הפניות/, it: /conduttor/i, sv: /\bLeads\b/, da: /\bLeads\b/, pt: /\bLeads\b/ } },
  { what: 'a team of leads read as sales leads', src: /(?<!\b(?:Sales|Marketing|Team) )\bLeads\b/, notOn: SALES_LEAD_FILES, except: /sales|marketing|CRM|prospect|lead[- ]?time|lead[- ]gen|zinc/i,
    bad: { ja: /リード(?!タイム)/, ko: /리드(?! ?타임)/ } },
  { what: 'material properties read as real estate', src: /\bpropert(?:y|ies)\b/i, onlyOn: ['chemical_mfg'], except: /intellectual property|real estate|plant property/i,
    bad: { fi: /kiinteist/i, sv: /fastighet/i, da: /ejendom/i, nl: /vastgoed|onroerend/i, de: /immobili/i, fr: /immobili/i, es: /inmobili|inmueble/i, pt: /imóve|imobili/i, it: /immobil/i,
           ja: /不動産|物件/, zh: /房地产|物业/, ko: /부동산/, he: /נכס|נדל"ן/, ar: /عقار/, hi: /संपत्ति/ } },
  ...['Databricks Vector Search', 'Anthropic', 'OpenAI', 'Amazon Bedrock', 'AWS Glue', 'Oracle', 'Sparkplug', 'Power BI', 'Pub/Sub', 'Event Hubs', 'Kinesis', 'SIX']
    .map(name => ({ what: `the name ${name} translated`, src: new RegExp(name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')),
      bad: Object.fromEntries(LANGS.map(l => [l, { test: t => !t.includes(name) }])) })),
];
const prose = s => { const w = s.trim().split(/\s+/); return w.length >= 3 && w.some(x => /^[a-z]{2,}/.test(x)); };
const senseFails = (s, t, l, file, found) => {
  const bare = found.reduce((x, f) => x.split(f).join(' '), t);
  return SENSE.filter(r => r.bad[l] && r.src.test(s) && !(r.except && r.except.test(s)) && !(r.only && r.only.indexOf(s) < 0) &&
    !(r.notOn && r.notOn.includes(file)) && !(r.onlyOn && !r.onlyOn.includes(file)) && r.bad[l].test(r.bad[l] instanceof RegExp ? bare : t)).map(r => r.what);
};

function offline(){
  const build = fs.existsSync(path.join(__dirname, 'build_i18n.js')) ? require('./build_i18n.js') : null;
  const named = build && new Set([...build.CURATED, ...build.STORY_NAME.values()]), one = f => f.replace(/e?s$/, '');
  const fails = [];
  let n = 0;
  for(const l of LANGS){
    const d = {}, from = {};
    for(const f of fs.readdirSync(path.join(TR, l))) if(f.endsWith('.json')){
      const part = JSON.parse(fs.readFileSync(path.join(TR, l, f), 'utf8'));
      for(const s in part) from[s] = f.slice(0, -5);
      Object.assign(d, part);
    }
    for(const [s, t] of Object.entries(d)){
      n++;
      if(/Zq\s*\d|\d\s*qZ/.test(t)) fails.push(`[${l}] a masking token is left in '${s.slice(0, 60)}'`);
      if(/[\u200B\uFEFF]/.test(t)) fails.push(`[${l}] a zero-width space hides in '${s.slice(0, 60)}'`);
      if(l === 'he' && /[\u0591-\u05C7]/.test(t)) fails.push(`[he] vowel points in '${s.slice(0, 60)}'`);
      if(build && !build.SENTENCE_END.test(s) && build.ADDED_END.test(t)) fails.push(`[${l}] a full stop the English does not have in '${s.slice(0, 60)}' => '${t.slice(-40)}'`);
      const found = build ? build.protect(s, l).found : [];
      const lost = found.find(f => (named.has(f) || named.has(one(f))) && !t.includes(f) && !(named.has(one(f)) && t.includes(one(f))));
      if(lost) fails.push(`[${l}] '${lost}' should read as written in '${s.slice(0, 60)}' => '${t.slice(0, 60)}'`);
      const CJK = '[\u3000-\u30ff\u3400-\u9fff\uff00-\uffef]', esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const split = found.find(f => (l === 'ja' || l === 'zh') ? (new RegExp('^' + CJK).test(f) && new RegExp(CJK + ' +' + esc(f)).test(t)) || (new RegExp(CJK + '$').test(f) && new RegExp(esc(f) + ' +' + CJK).test(t))
        : l === 'he' && /^[\u05D0-\u05EA]/.test(f) && new RegExp('(^|[\\s(])[ובלמהשכ]{1,3}-\u2060?' + esc(f)).test(t));
      if(split) fails.push(`[${l}] '${split}' is cut off from the word next to it in '${s.slice(0, 60)}' => '${t.slice(0, 60)}'`);
      if(['de', 'nl', 'da', 'sv'].includes(l) && build && build.joinKept && build.joinKept(t, found, l) !== t) fails.push(`[${l}] a kept term does not join the words next to it in '${s.slice(0, 60)}' => '${t.slice(0, 60)}'`);
      const colon = l === 'fi' && build && build.pinnedTerm && found.find(f => build.pinnedTerm(f, l) && new RegExp(esc(f) + ':\\p{L}', 'u').test(t));
      if(colon) fails.push(`[fi] '${colon}' takes its case ending after a colon in '${s.slice(0, 60)}' => '${t.slice(0, 60)}'`);
      for(const w of build && build.pinUnconfirmed ? build.pinUnconfirmed(s, t, l) : []) fails.push(`[${l}] no word in the translation confirms the sense '${w}' stands for in '${s.slice(0, 60)}' => '${t.slice(0, 60)}'`);
      for(const what of senseFails(s, t, l, from[s], found)) fails.push(`[${l}] ${what}: '${s.slice(0, 60)}' => '${t.slice(0, 60)}'`);
    }
    for(const s of TOUR){
      if(prose(s) && !d[s]) fails.push(`[${l}] the tour text '${s.slice(0, 60)}' has no translation`);
      if(d[s] && /\{k[12]\}/.test(s) && !(d[s].includes('{k1}') && d[s].includes('{k2}'))) fails.push(`[${l}] the tour lost its key placeholders`);
    }
  }
  return { n, fails, partial: !build };
}

async function rendered(){
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port + '/index.html';
  const browser = await chromium.launch();
  const errors = [];
  const grab = async (q, view) => {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    await ctx.addInitScript(() => { try { localStorage.setItem('dbx-arch-tour-v1', '1'); } catch (e) {} });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(withView(base + q, 'detailed'), { waitUntil: 'networkidle' });
    await boardReady(page);
    await page.waitForTimeout(300);
    const r = await page.evaluate(async (view) => {
      const out = new Set();
      const take = (root, skipLinks) => {
        if(!root) return;
        const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let n;
        while((n = w.nextNode())){
          const p = n.parentElement;
          if(!p || p.closest('header.top, svg, style, script, .tagpill') || (skipLinks && p.closest('a'))) continue;
          const o = p.classList.contains('kw') ? p.parentElement : p;
          const t = (o.querySelector(':scope > wbr, :scope > .kw') ? o.textContent : n.textContent).replace(/\s+/g, ' ').trim();
          if(/[A-Za-z]{3}/.test(t)) out.add(t);
        }
        root.querySelectorAll('[title], [aria-label], [placeholder]').forEach(e => {
          if(e.closest('header.top, svg')) return;
          ['title', 'aria-label', 'placeholder'].forEach(a => { const v = (e.getAttribute(a) || '').trim(); if(/[A-Za-z]{3}/.test(v)) out.add(v); });
        });
      };
      const names = new Set(Object.keys(LINKS || {}));
      Object.values(byId).forEach(r => { if(r && r.tile) names.add(r.tile.n); });
      const tags = view === 'board' ? [...document.querySelectorAll('#board .tagpill')].map(e => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean) : [];
      const cr = REGIONS.clouds[curCloud()];
      Object.values(REGIONS.clouds).forEach(c => {
        Object.keys(c.meta).forEach(k => names.add(rgName(k)));
        Object.keys(c.derived).forEach(k => names.add(k));
        c.designated.rows.forEach(d => names.add(d.n));
        c.partner.rows.forEach(d => names.add(d.n));
        c.elsewhere.forEach(e => names.add(rgName(e.n)));
        c.regions.forEach(r => names.add(r.code));
      });
      names.add(creditText());
      Object.values((ARCH.cloud && ARCH.cloud.providers) || {}).forEach(p => p && p.label && names.add(p.label));
      if(view === 'panel') take(document.getElementById('drawer'), true);
      if(view === 'board'){ take(document.getElementById('board'), false); take(document.getElementById('drawer'), true); }
      if(view === 'detail'){
        const id = Object.keys(byId).find(k => byId[k].tile && byId[k].tile.n === 'SQL Warehouses' && byId[k].el && byId[k].el.closest('#platform'));
        openDetail(id); await new Promise(r => setTimeout(r, 300));
        take(document.getElementById('drawer'), true);
      }
      if(view === 'tour'){
        window.__startArchTour();
        for(let i = 0; i < 12; i++){
          await new Promise(r => setTimeout(r, 250));
          const pop = document.querySelector('.tour-pop');
          if(!pop) break;
          pop.querySelectorAll('h4, p, button').forEach(e => { const t = e.textContent.replace(/\s+/g, ' ').trim(); if(/[A-Za-z]{3}/.test(t)) out.add(t); });
          const [cur, tot] = document.querySelector('.tour-step').textContent.split('/').map(x => parseInt(x, 10));
          if(cur >= tot) break;
          pop.querySelector('.tour-btn.accent').click();
        }
      }
      if(view === 'excel') regionSheet().slice(0, 1)[0].forEach(h => out.add(h));
      return { texts: [...out], names: [...names], tags };
    }, view);
    await ctx.close();
    return r;
  };
  const views = [
    ['board', '?industry=banking'], ['tour', '?industry=banking'], ['detail', '?cloud=azure'],
    ['panel', '?cloud=azure&region=qatarcentral&panel=region'], ['panel', '?cloud=aws&region=us-east-1&panel=region'],
    ['panel', '?cloud=gcp&region=us-central1&panel=region'], ['excel', '?cloud=azure&region=qatarcentral&panel=region'],
  ];
  const fails = [];
  let checked = 0;
  for(const [view, q] of views){
    const en = await grab(q, view);
    const enSet = new Set(en.texts);
    for(const l of LANGS){
      const tr = await grab(q + '&lang=' + l, view);
      const names = new Set(tr.names), same = new Set((SAME._all || []).concat(SAME[l] || []));
      for(const t of tr.texts){
        checked++;
        if(!enSet.has(t) || names.has(t) || same.has(t)) continue;
        if(!/[a-z]{3}/.test(t)) continue;
        fails.push(`[${l}] ${view} ${q}: '${t.slice(0, 90)}' is still English`);
      }
      const enTags = new Set(en.tags);
      for(const t of tr.tags){
        checked++;
        if(enTags.has(t) && !same.has(t)) fails.push(`[${l}] ${view} ${q}: the tag '${t}' is still English`);
      }
      if(view === 'board' && tr.tags.length !== en.tags.length) fails.push(`[${l}] ${view} ${q}: ${tr.tags.length} tags on screen, ${en.tags.length} in English`);
    }
  }
  await browser.close();
  server.close();
  return { checked, fails, errors };
}

module.exports = { senseFails };

if(require.main === module) (async () => {
  const a = offline();
  console.log(`offline: ${LANGS.length} languages, ${a.n} translations, ${TOUR.length} tour strings, ${a.fails.length} problems`);
  if(a.partial) console.log('offline: tools/build_i18n.js is not in this checkout, so names that stay as written and full stops the English does not have are not checked');
  const b = await rendered();
  console.log(`rendered: ${b.checked} strings on screen in ${LANGS.length} languages, ${b.fails.length} still English`);
  const fails = a.fails.concat(b.fails, b.errors.slice(0, 5).map(e => 'page error: ' + e));
  if(fails.length){
    console.log(`\nFAIL (${fails.length})`);
    fails.slice(0, 200).forEach(f => console.log('  - ' + f));
    process.exit(1);
  }
  console.log('PASS: every string a reader sees is translated with the right sense, in every language');
})().catch(e => { console.error(e); process.exit(2); });
