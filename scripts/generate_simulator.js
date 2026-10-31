const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const CURRENT_CONV_ID = '916c13f3-c7ad-4286-9722-ca8345fa735c';
const ARTIFACT_DIR = path.join(process.env.HOME || '/Users/udaymukhija', '.gemini/antigravity/brain', CURRENT_CONV_ID);
const INVENTORY_PATH = path.join(ROOT_DIR, 'AUM_ESTATES_Website_For_Hostinger', 'data', 'public_inventory.json');

const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AUM ESTATES — Architectural Grid Live Simulator</title>
  <script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script>
  <style>
    :root {
      --primary: #EF4037;
      --oxblood: #713240;
      --gold: #C5A059;
      --ink: #151515;
      --paper: #F8F7F4;
      --surface: #FFFFFF;
      --line: #E5E4DE;
    }
    .custom-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
    .custom-scroll::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
    .custom-scroll::-webkit-scrollbar-track { background: transparent; }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen antialiased font-sans p-2 sm:p-4">

  <!-- Top Simulator Bar -->
  <header class="max-w-7xl mx-auto mb-4 bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-xl">
    <div class="flex items-center gap-3">
      <div class="w-9 h-9 rounded-lg bg-red-600/20 border border-red-500/30 flex items-center justify-center font-serif text-red-500 font-bold text-lg">A</div>
      <div>
        <div class="flex items-center gap-2">
          <span class="font-bold text-sm sm:text-base tracking-wide text-white">AUM ESTATES</span>
          <span class="text-[11px] uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">Live Simulator</span>
        </div>
        <p class="text-xs text-slate-400">Architectural Grid (Study 06) · 347 Verified Gurgaon Mandates</p>
      </div>
    </div>

    <!-- Simulator Controls -->
    <div class="flex flex-wrap items-center gap-2">
      <!-- Viewport Mode -->
      <div class="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-1 text-xs">
        <button id="vpDesktop" onclick="setViewport('desktop')" class="px-2.5 py-1 rounded bg-slate-800 text-white font-medium transition">Desktop</button>
        <button id="vpTablet" onclick="setViewport('tablet')" class="px-2.5 py-1 rounded text-slate-400 hover:text-white transition">Tablet</button>
        <button id="vpMobile" onclick="setViewport('mobile')" class="px-2.5 py-1 rounded text-slate-400 hover:text-white transition">Mobile (390px)</button>
      </div>

      <!-- Mode Switcher -->
      <div class="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-1 text-xs">
        <button id="modeVisitor" onclick="setPresentation('visitor')" class="px-2.5 py-1 rounded bg-red-600 text-white font-medium transition">Visitor Clean</button>
        <button id="modeStudy" onclick="setPresentation('study')" class="px-2.5 py-1 rounded text-slate-400 hover:text-white transition">Study 06 Chrome</button>
      </div>

      <!-- Server Link -->
      <a href="http://localhost:8000/" target="_blank" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 flex items-center gap-1.5 border border-slate-700 transition">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span>Local Port 8000 ↗</span>
      </a>
    </div>
  </header>

  <!-- Main Simulator Frame Container -->
  <main class="max-w-7xl mx-auto flex flex-col items-center">
    <div id="simFrame" class="w-full transition-all duration-300 bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-700/50 flex flex-col min-h-[820px]">
      
      <!-- Optional Study 06 Chrome Ribbon -->
      <div id="studyRibbon" class="hidden bg-[#151515] text-[#E9E9E5] px-4 py-2 text-xs flex items-center justify-between border-b border-slate-800">
        <div class="flex items-center gap-3">
          <span class="font-bold tracking-wider text-rose-300">DESIGN STUDY / 06</span>
          <span class="text-slate-400 hidden sm:inline">International Style &amp; Elevation · 12-Column Spatial Grid</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded bg-slate-800 text-[11px] text-slate-300 border border-slate-700 font-mono">Palette: Red / White / Ink</span>
          <span class="px-2 py-0.5 rounded bg-slate-800 text-[11px] text-slate-300 border border-slate-700 font-mono">Type: IBM Plex</span>
        </div>
      </div>

      <!-- App Header -->
      <header class="sticky top-0 z-30 bg-[#F8F7F4]/95 backdrop-blur border-b border-[#D7D6D0] px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div class="flex items-center gap-3 cursor-pointer" onclick="showView('home')">
          <div class="w-8 h-8 rounded bg-[#1c0b10] border border-[#c5a059]/40 flex items-center justify-center font-serif text-[#c5a059] font-bold text-base">A</div>
          <div>
            <div class="font-bold text-sm tracking-widest text-[#151515]">AUM ESTATES</div>
            <div class="text-[10px] uppercase tracking-wider text-[#7A303B] font-semibold">Private Advisory · Est. 2002</div>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <nav class="hidden md:flex items-center gap-6 text-xs font-semibold tracking-wider uppercase text-slate-700">
          <button onclick="showView('home')" id="navHome" class="text-[#7A303B] border-b-2 border-[#7A303B] pb-1">01 / Task Grid</button>
          <button onclick="showView('browse', {intent:'buy'})" id="navBrowse" class="hover:text-[#7A303B] pb-1 transition">02 / Portfolio (<span id="totalBadge">347</span>)</button>
          <button onclick="showView('locations')" id="navLocations" class="hover:text-[#7A303B] pb-1 transition">03 / Corridors</button>
          <button onclick="showView('about')" id="navAbout" class="hover:text-[#7A303B] pb-1 transition">04 / Advisory</button>
        </nav>

        <!-- Direct Action Contacts -->
        <div class="flex items-center gap-2 sm:gap-3">
          <a href="tel:+919811157018" class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:border-slate-800 text-xs font-semibold text-slate-800 transition">
            <span>☎</span>
            <span>+91 98111 57018</span>
          </a>
          <button onclick="openWhatsAppModal('General Advisory Consultation', 'AUM-DESK', 'Gurgaon', 'Private')" class="px-3.5 py-1.5 rounded-lg bg-[#7A303B] hover:bg-[#5E242E] text-white text-xs font-semibold shadow-sm transition">
            WhatsApp Desk ↗
          </button>
        </div>
      </header>

      <!-- VIEW 1: HOME TASK GRID -->
      <section id="viewHome" class="p-4 sm:p-8 flex-1 flex flex-col justify-between bg-[#F8F7F4]">
        <div class="max-w-5xl mx-auto w-full">
          <!-- Hero Section -->
          <div class="mb-8 pt-2">
            <div class="text-xs font-bold uppercase tracking-widest text-[#7A303B] mb-1">AUM ESTATES / GURUGRAM &amp; SELECTED MARKETS</div>
            <h1 class="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#151515] leading-tight mb-2">
              Property, <span class="text-[#7A303B] italic font-serif">clearly.</span>
            </h1>
            <p class="text-slate-600 text-sm sm:text-base max-w-xl">
              Twenty-two years of fiduciary property stewardship across Golf Course Road, DLF Phase 1–5, and prime Gurgaon enclaves.
            </p>
          </div>

          <!-- 12-Column Spatial Grid -->
          <div class="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 mb-8">
            
            <!-- Cell 01: Search Console (Col 1-6) -->
            <div class="md:col-span-6 bg-[#EF4037] text-white rounded-xl p-5 sm:p-6 shadow-md flex flex-col justify-between">
              <div>
                <div class="flex justify-between text-[11px] font-mono tracking-wider text-rose-200 mb-2">
                  <span>01 / FIND A PROPERTY</span>
                  <span>START HERE</span>
                </div>
                <h3 class="text-xl sm:text-2xl font-bold leading-snug mb-2">Know what you're looking for?</h3>
                <p class="text-xs text-rose-100 mb-4">Start with the essentials. Refine corridor and budget in the next step.</p>
              </div>

              <div class="space-y-2.5 pt-2 border-t border-rose-400/40">
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="text-[10px] font-bold uppercase tracking-wider text-rose-200 block mb-1">Intent</label>
                    <select id="quickIntent" class="w-full bg-white text-slate-900 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none">
                      <option value="buy">Buy</option>
                      <option value="rent">Rent</option>
                      <option value="commercial">Commercial</option>
                      <option value="land">Plots &amp; Land</option>
                    </select>
                  </div>
                  <div>
                    <label class="text-[10px] font-bold uppercase tracking-wider text-rose-200 block mb-1">Corridor</label>
                    <select id="quickLocation" class="w-full bg-white text-slate-900 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none">
                      <option value="">All Gurgaon Corridors</option>
                      <option value="Golf Course Road">Golf Course Road &amp; DLF 5</option>
                      <option value="DLF">DLF Phase 1–5</option>
                      <option value="Golf Course Ext Road">Golf Course Extn &amp; SPR</option>
                      <option value="Nirvana">Nirvana Country &amp; Sec 50</option>
                      <option value="Dwarka Expressway">Dwarka Expressway (DXP)</option>
                      <option value="Sohna Road">Sohna Road Corridor</option>
                    </select>
                  </div>
                </div>
                <button onclick="triggerQuickSearch()" class="w-full bg-[#151515] hover:bg-black text-white font-bold text-xs py-2.5 rounded-lg transition flex items-center justify-center gap-1.5 shadow">
                  <span>Explore Matching Mandates</span>
                  <span>↗</span>
                </button>
              </div>
            </div>

            <!-- Cell 02: Buy Home (Col 7-9) -->
            <div onclick="showView('browse', {intent:'buy'})" class="md:col-span-3 bg-white hover:bg-slate-50 border border-[#D7D6D0] rounded-xl p-5 cursor-pointer transition shadow-sm hover:shadow-md flex flex-col justify-between group">
              <div class="flex justify-between items-start text-[11px] font-mono text-slate-400">
                <span>02 / BUY</span>
                <span class="text-base group-hover:translate-x-1 group-hover:-translate-y-1 transition text-[#7A303B]">↗</span>
              </div>
              <div class="my-4">
                <h4 class="font-bold text-lg text-slate-900 leading-tight">Buy a residence.</h4>
                <p class="text-xs text-slate-500 mt-1">Condominiums · Builder Floors · Penthouses</p>
              </div>
              <span class="text-xs font-bold text-[#7A303B] group-hover:underline">305 Verified Listings →</span>
            </div>

            <!-- Cell 03: Rent (Col 10-12) -->
            <div onclick="showView('browse', {intent:'rent'})" class="md:col-span-3 bg-white hover:bg-slate-50 border border-[#D7D6D0] rounded-xl p-5 cursor-pointer transition shadow-sm hover:shadow-md flex flex-col justify-between group">
              <div class="flex justify-between items-start text-[11px] font-mono text-slate-400">
                <span>03 / RENT</span>
                <span class="text-base group-hover:translate-x-1 group-hover:-translate-y-1 transition text-[#7A303B]">↗</span>
              </div>
              <div class="my-4">
                <h4 class="font-bold text-lg text-slate-900 leading-tight">Find a rental.</h4>
                <p class="text-xs text-slate-500 mt-1">Executive leasing &amp; high-end corporate rentals</p>
              </div>
              <span class="text-xs font-bold text-[#7A303B] group-hover:underline">46 Available Rentals →</span>
            </div>

            <!-- Cell 04: Commercial (Col 1-3) -->
            <div onclick="showView('browse', {intent:'commercial'})" class="md:col-span-3 bg-white hover:bg-slate-50 border border-[#D7D6D0] rounded-xl p-5 cursor-pointer transition shadow-sm hover:shadow-md flex flex-col justify-between group">
              <div class="flex justify-between items-start text-[11px] font-mono text-slate-400">
                <span>04 / COMMERCIAL</span>
                <span class="text-base group-hover:translate-x-1 group-hover:-translate-y-1 transition text-[#7A303B]">↗</span>
              </div>
              <div class="my-4">
                <h4 class="font-bold text-lg text-slate-900 leading-tight">Business space.</h4>
                <p class="text-xs text-slate-500 mt-1">Pre-leased assets &amp; corporate offices</p>
              </div>
              <span class="text-xs font-bold text-[#7A303B] group-hover:underline">36 Commercial Units →</span>
            </div>

            <!-- Cell 05: Plots & Land (Col 4-6) -->
            <div onclick="showView('browse', {intent:'land'})" class="md:col-span-3 bg-white hover:bg-slate-50 border border-[#D7D6D0] rounded-xl p-5 cursor-pointer transition shadow-sm hover:shadow-md flex flex-col justify-between group">
              <div class="flex justify-between items-start text-[11px] font-mono text-slate-400">
                <span>05 / LAND</span>
                <span class="text-base group-hover:translate-x-1 group-hover:-translate-y-1 transition text-[#7A303B]">↗</span>
              </div>
              <div class="my-4">
                <h4 class="font-bold text-lg text-slate-900 leading-tight">Plots &amp; land.</h4>
                <p class="text-xs text-slate-500 mt-1">HSVP residential plots &amp; freehold parcels</p>
              </div>
              <span class="text-xs font-bold text-[#7A303B] group-hover:underline">102 Verified Plots →</span>
            </div>

            <!-- Cell 06: Locations (Col 7-9) -->
            <div onclick="showView('locations')" class="md:col-span-3 bg-white hover:bg-slate-50 border border-[#D7D6D0] rounded-xl p-5 cursor-pointer transition shadow-sm hover:shadow-md flex flex-col justify-between group">
              <div class="flex justify-between items-start text-[11px] font-mono text-slate-400">
                <span>06 / BY PLACE</span>
                <span class="text-base group-hover:translate-x-1 group-hover:-translate-y-1 transition text-[#7A303B]">↗</span>
              </div>
              <div class="my-4">
                <h4 class="font-bold text-lg text-slate-900 leading-tight">Explore corridors.</h4>
                <p class="text-xs text-slate-500 mt-1">GCR, DLF 1–5, Extn, SPR, Nirvana, DXP</p>
              </div>
              <span class="text-xs font-bold text-[#7A303B] group-hover:underline">6 Micro-Markets →</span>
            </div>

            <!-- Cell 07: Direct Advisory (Col 10-12) -->
            <div onclick="showView('about')" class="md:col-span-3 bg-slate-900 text-white rounded-xl p-5 cursor-pointer transition shadow-md hover:bg-black flex flex-col justify-between group">
              <div class="flex justify-between items-start text-[11px] font-mono text-slate-400">
                <span>07 / ADVISORY</span>
                <span class="text-base text-rose-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition">↗</span>
              </div>
              <div class="my-4">
                <h4 class="font-bold text-lg text-white leading-tight">Ajay Mukhija</h4>
                <p class="text-xs text-slate-300 mt-1">Principal fiduciary guidance since 2002</p>
              </div>
              <span class="text-xs font-bold text-rose-400 group-hover:underline">+91 98111 57018 →</span>
            </div>

          </div>

          <!-- Trust Strip -->
          <div class="bg-white rounded-xl p-4 border border-[#D7D6D0] grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-xs">
            <div>
              <div class="text-xl font-extrabold text-[#7A303B]">22+ Years</div>
              <div class="text-slate-500 mt-0.5">Gurgaon Pedigree (2002)</div>
            </div>
            <div>
              <div class="text-xl font-extrabold text-slate-900">347 Mandates</div>
              <div class="text-slate-500 mt-0.5">100% Verified Titles</div>
            </div>
            <div>
              <div class="text-xl font-extrabold text-[#7A303B]">Haryana RERA</div>
              <div class="text-slate-500 mt-0.5">Registered Brokerage</div>
            </div>
            <div>
              <div class="text-xl font-extrabold text-slate-900">Nirvana C-210</div>
              <div class="text-slate-500 mt-0.5">Physical HQ Sector 50</div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="max-w-5xl mx-auto w-full mt-8 pt-4 border-t border-slate-200 flex flex-wrap justify-between items-center text-xs text-slate-500">
          <div>© 2002–2026 AUM ESTATES — Independent Luxury Real Estate Advisory</div>
          <div class="flex gap-4">
            <button onclick="showView('about')" class="hover:text-slate-900">Founder</button>
            <button onclick="showView('locations')" class="hover:text-slate-900">Micro-Markets</button>
            <a href="tel:+919811157018" class="text-[#7A303B] font-bold">Direct: +91 98111 57018</a>
          </div>
        </div>
      </section>

      <!-- VIEW 2: PORTFOLIO BROWSER -->
      <section id="viewBrowse" class="hidden p-4 sm:p-8 flex-1 flex flex-col bg-white">
        <div class="max-w-6xl mx-auto w-full flex-1 flex flex-col">
          
          <!-- Browse Header -->
          <div class="flex flex-wrap items-end justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
            <div>
              <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#7A303B] mb-1">
                <button onclick="showView('home')" class="hover:underline">← Home</button>
                <span>/</span>
                <span>Verified Gurgaon Portfolio</span>
              </div>
              <h2 id="browseTitle" class="text-2xl sm:text-3xl font-bold text-slate-900">Find your next residence.</h2>
            </div>
            <div class="text-right">
              <span id="resultCountBadge" class="inline-block px-3 py-1 rounded-full bg-slate-100 border border-slate-200 font-mono text-xs font-bold text-slate-800">
                305 verified properties
              </span>
            </div>
          </div>

          <!-- Filter Toolbar -->
          <div class="bg-[#F8F7F4] p-4 rounded-xl border border-slate-200 mb-6 flex flex-wrap items-center gap-3">
            <!-- Intent -->
            <div class="w-full sm:w-auto">
              <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Intent</label>
              <select id="filterIntent" onchange="applyFilters()" class="w-full sm:w-36 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold">
                <option value="buy">Buy</option>
                <option value="rent">Rent</option>
                <option value="commercial">Commercial</option>
                <option value="land">Plots &amp; Land</option>
              </select>
            </div>

            <!-- Corridor -->
            <div class="w-full sm:w-auto">
              <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Corridor</label>
              <select id="filterLocation" onchange="applyFilters()" class="w-full sm:w-48 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold">
                <option value="">All Corridors</option>
                <option value="Golf Course Road">Golf Course Road &amp; DLF 5</option>
                <option value="DLF">DLF Phase 1–5</option>
                <option value="Golf Course Ext Road">Golf Course Extn &amp; SPR</option>
                <option value="Nirvana">Nirvana Country &amp; Sec 50</option>
                <option value="Dwarka Expressway">Dwarka Expressway (DXP)</option>
                <option value="Sohna Road">Sohna Road Corridor</option>
              </select>
            </div>

            <!-- Category -->
            <div class="w-full sm:w-auto">
              <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Category</label>
              <select id="filterType" onchange="applyFilters()" class="w-full sm:w-44 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold">
                <option value="">All Property Types</option>
                <option value="Apartment">Luxury Condominiums</option>
                <option value="builder-floor">DLF Builder Floors</option>
                <option value="plot">HSVP Plots &amp; Land</option>
                <option value="Commercial">Commercial Offices</option>
                <option value="Villa">Villas &amp; Kothis</option>
              </select>
            </div>

            <!-- Budget -->
            <div class="w-full sm:w-auto">
              <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Budget</label>
              <select id="filterBudget" onchange="applyFilters()" class="w-full sm:w-36 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold">
                <option value="">Any Budget</option>
                <option value="< 3 Cr">Under ₹3 Cr</option>
                <option value="3–7 Cr">₹3 Cr – ₹7 Cr</option>
                <option value="7–15 Cr">₹7 Cr – ₹15 Cr</option>
                <option value="15–30 Cr">₹15 Cr – ₹30 Cr</option>
                <option value="30+ Cr">₹30+ Cr</option>
              </select>
            </div>

            <!-- Reset Button -->
            <div class="w-full sm:w-auto sm:ml-auto pt-2 sm:pt-4">
              <button onclick="resetAllFilters()" class="w-full sm:w-auto px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-200 text-xs font-bold text-slate-700 transition">
                Reset Filters ↺
              </button>
            </div>
          </div>

          <!-- Live Results Grid -->
          <div id="resultsGrid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
            <!-- Dynamically populated -->
          </div>

          <!-- Empty Fallback -->
          <div id="emptyState" class="hidden text-center py-16 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
            <div class="text-3xl mb-2">🏛️</div>
            <h3 class="text-lg font-bold text-slate-800">No properties match this specific filter.</h3>
            <p class="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">AUM ESTATES represents discrete private off-market mandates not listed online. Contact Ajay Mukhija directly for private shortlists.</p>
            <button onclick="resetAllFilters()" class="px-4 py-2 rounded-lg bg-[#7A303B] text-white text-xs font-bold">Reset Filters →</button>
          </div>
        </div>
      </section>

      <!-- VIEW 3: PROPERTY DOSSIER VIEW -->
      <section id="viewDetail" class="hidden p-4 sm:p-8 flex-1 flex flex-col bg-[#F8F7F4]">
        <div class="max-w-5xl mx-auto w-full">
          <!-- Back button -->
          <div class="mb-4">
            <button onclick="showView('browse')" class="inline-flex items-center gap-1.5 text-xs font-bold text-[#7A303B] hover:underline">
              ← Return to Property Collection
            </button>
          </div>

          <div class="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden grid grid-cols-1 md:grid-cols-12">
            <!-- Left Details (8 cols) -->
            <div class="md:col-span-8 p-6 sm:p-8 border-b md:border-b-0 md:border-r border-slate-200">
              <div class="flex items-center gap-2 mb-2">
                <span class="px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-bold tracking-wider uppercase">Verified Listing</span>
                <span id="dtRef" class="text-[11px] font-mono text-slate-400">REF / AUM-WEB-000348</span>
              </div>

              <h1 id="dtTitle" class="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-snug mb-2">Property Particulars</h1>
              <p id="dtLocation" class="text-sm text-slate-600 font-medium mb-4">Golf Course Road, Sector 54, Gurgaon</p>
              
              <div class="text-2xl sm:text-3xl font-extrabold text-[#7A303B] font-mono mb-6" id="dtPrice">₹9.25 Cr</div>

              <!-- Specifications Grid -->
              <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 border-b border-slate-100 pb-2">Verified Specifications</h4>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6" id="dtSpecs">
                <!-- Dynamically populated -->
              </div>

              <!-- Description -->
              <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 border-b border-slate-100 pb-2">Property Particulars &amp; Due Diligence</h4>
              <p id="dtDesc" class="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6"></p>

              <!-- Transparency notice -->
              <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                <strong class="text-slate-700 block mb-0.5">RERA &amp; Fiduciary Transparency Notice:</strong>
                All property particulars are vetted against official HSVP / registry records. Floor plans, exact title deeds, and on-site inspection slots are provided directly upon advisory desk inquiry.
              </div>
            </div>

            <!-- Right Advisory Card (4 cols) -->
            <div class="md:col-span-4 p-6 sm:p-8 bg-[#F8F7F4] flex flex-col justify-between">
              <div>
                <div class="text-xs font-bold uppercase tracking-wider text-[#7A303B] mb-1">Direct Advisory Desk</div>
                <h3 class="text-lg font-bold text-slate-900 leading-snug mb-2">Request Complete Dossier</h3>
                <p class="text-xs text-slate-600 mb-6 leading-relaxed">
                  Consult directly with senior advisory partner Ajay Mukhija for title diligence, layout blueprints, and private site visits.
                </p>

                <div class="space-y-3">
                  <button id="dtWhatsAppBtn" class="w-full py-3 rounded-xl bg-[#7A303B] hover:bg-[#5E242E] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition">
                    <span>Inquire on WhatsApp</span>
                    <span>↗</span>
                  </button>

                  <a href="tel:+919811157018" class="w-full py-2.5 rounded-xl border border-slate-300 hover:border-slate-800 bg-white text-slate-800 font-bold text-xs flex items-center justify-center gap-2 transition">
                    <span>☎ Call Ajay Mukhija</span>
                  </a>
                </div>
              </div>

              <div class="mt-8 pt-4 border-t border-slate-200 text-xs text-slate-500">
                <div class="font-bold text-slate-800">AUM ESTATES Headquarters:</div>
                <div class="mt-1">C-210, Nirvana Courtyard, Nirvana Country, Sector 50, Gurgaon 122018</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- VIEW 4: LOCATIONS VIEW -->
      <section id="viewLocations" class="hidden p-4 sm:p-8 flex-1 flex flex-col bg-[#F8F7F4]">
        <div class="max-w-5xl mx-auto w-full">
          <div class="mb-6">
            <span class="text-xs font-bold uppercase tracking-widest text-[#7A303B]">LOCATION INDEX / 06 PRIME CORRIDORS</span>
            <h2 class="text-3xl font-extrabold text-slate-900 mt-1">Start with the neighbourhood.</h2>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="corridorCards">
            <!-- Dynamically populated -->
          </div>
        </div>
      </section>

      <!-- VIEW 5: ABOUT THE ADVISORY -->
      <section id="viewAbout" class="hidden p-4 sm:p-8 flex-1 flex flex-col bg-white">
        <div class="max-w-4xl mx-auto w-full py-4">
          <div class="text-xs font-bold uppercase tracking-widest text-[#7A303B] mb-1">FOUNDED 2002 · GURGAON</div>
          <h2 class="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight mb-4">
            Real estate is local.<br>Advice is personal.
          </h2>
          <p class="text-slate-600 text-sm sm:text-base leading-relaxed mb-8">
            AUM ESTATES is an independent Gurugram-based luxury property advisory practice founded in 2002 by <strong>Ajay Mukhija</strong>. We advise high-net-worth individuals, family offices, and NRI clients across Golf Course Road, DLF Phase 1–5, Nirvana Country, and prime Gurgaon growth corridors.
          </p>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div class="bg-slate-50 p-5 rounded-xl border border-slate-200">
              <div class="text-xs font-bold text-[#7A303B] uppercase mb-1">01 / Diligence</div>
              <h4 class="font-bold text-slate-900 mb-1">Forensic Title Check</h4>
              <p class="text-xs text-slate-500">Every listing is verified for clear chain-of-title, HSVP encumbrance status, and approved sanctioned plans.</p>
            </div>
            <div class="bg-slate-50 p-5 rounded-xl border border-slate-200">
              <div class="text-xs font-bold text-[#7A303B] uppercase mb-1">02 / Headquarters</div>
              <h4 class="font-bold text-slate-900 mb-1">C-210 Nirvana Courtyard</h4>
              <p class="text-xs text-slate-500">Located in Sector 50, Gurgaon 122018. Open Monday to Saturday for confidential acquisition meetings.</p>
            </div>
            <div class="bg-slate-50 p-5 rounded-xl border border-slate-200">
              <div class="text-xs font-bold text-[#7A303B] uppercase mb-1">03 / Compliance</div>
              <h4 class="font-bold text-slate-900 mb-1">Haryana RERA Certified</h4>
              <p class="text-xs text-slate-500">Operating in full compliance with Haryana Real Estate Regulatory Authority brokerage standards.</p>
            </div>
          </div>

          <div class="p-6 bg-slate-900 text-white rounded-2xl flex flex-wrap items-center justify-between gap-4">
            <div>
              <div class="text-xs font-mono text-rose-300">PRINCIPAL ADVISORY LINE</div>
              <div class="text-2xl font-bold font-mono">+91 98111 57018</div>
              <div class="text-xs text-slate-400 mt-0.5">Ajay Mukhija · Private Advisory Desk</div>
            </div>
            <div class="flex gap-2">
              <a href="tel:+919811157018" class="px-4 py-2.5 rounded-lg bg-white text-slate-900 font-bold text-xs hover:bg-slate-100 transition">
                Call Direct Line ↗
              </a>
              <button onclick="openWhatsAppModal('General Mandate Inquiry', 'AUM-DESK', 'Gurgaon', 'Private')" class="px-4 py-2.5 rounded-lg bg-[#EF4037] text-white font-bold text-xs hover:bg-red-600 transition">
                WhatsApp Desk ↗
              </button>
            </div>
          </div>
        </div>
      </section>

    </div>
  </main>

  <!-- Interactive WhatsApp Modal Simulator -->
  <div id="waModal" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 hidden">
    <div class="bg-slate-900 border border-slate-800 text-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
      <button onclick="closeWhatsAppModal()" class="absolute top-4 right-4 text-slate-400 hover:text-white text-lg">✕</button>
      
      <div class="flex items-center gap-2.5 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
        <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
        <span>High-Intent Lead Capture Engine</span>
      </div>

      <h3 class="text-lg font-bold text-white mb-1">Simulated WhatsApp Inquiry</h3>
      <p class="text-xs text-slate-400 mb-4">Destination: <span class="font-mono text-slate-200">+91 98738 13595</span> (Advisory Desk)</p>

      <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-emerald-300 mb-4 whitespace-pre-wrap leading-relaxed" id="waMessageText"></div>

      <div class="flex gap-2">
        <a id="waExternalLink" href="#" target="_blank" class="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs text-center transition">
          Open in Real WhatsApp ↗
        </a>
        <button onclick="closeWhatsAppModal()" class="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold">
          Close
        </button>
      </div>
    </div>
  </div>

  <script>
    const INVENTORY = ${JSON.stringify(inventory)};
    let currentFilteredList = [];

    // Helper functions
    function norm(s) {
      return String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9+]+/g, ' ').trim();
    }

    function cleanTitle(s) {
      if (!s) return 'Featured Gurgaon Residence';
      return String(s).replace(/\\s+MP$/i, '').replace(/\\s+OC tower$/i, ' (OC Received)').replace(/\\s+#\\d+$/i, '').trim();
    }

    function formatPrice(item) {
      if (item.rent_value && item.transaction_type && item.transaction_type.toLowerCase().includes('rent')) {
        return '₹' + Number(item.rent_value).toLocaleString('en-IN') + ' / month';
      }
      if (item.price_text && !item.price_text.toLowerCase().includes('call')) {
        return item.price_text;
      }
      if (item.price_value) {
        return '₹' + item.price_value + ' ' + (item.price_unit || 'Cr');
      }
      return 'Price on Request';
    }

    function matchesCorridor(o, q) {
      if (!q) return true;
      const qn = norm(q);
      const fullText = norm([o.city, o.locality, o.sector, o.micro_location, o.project_name, o.listing_title].join(' '));
      if (qn === 'sohna road') {
        return fullText.includes('sohna road') || fullText.includes('malibu') || fullText.includes('uppal') || fullText.includes('vipul') || fullText.includes('eldeco');
      }
      if (qn === 'golf course ext road' || qn.includes('spr')) {
        const ext = ['golf course extension', 'golf course ext', 'spr', 'sector 58', 'sector 59', 'sector 61', 'sector 62', 'sector 63', 'sector 65', 'sector 66', 'arbour', 'elevate', 'araya', 'presidia', 'grand arch'];
        return ext.some(k => fullText.includes(k));
      }
      if (qn === 'golf course road' || qn.includes('dlf 5')) {
        const gcr = ['golf course road', 'golf course rd', 'dlf 5', 'belaire', 'park place', 'magnolias', 'aralias', 'camellias', 'crest', 'carlton'];
        return gcr.some(k => fullText.includes(k));
      }
      if (qn.includes('dwarka') || qn.includes('dxp')) {
        const dxp = ['dwarka expressway', 'dxp', 'sector 106', 'sector 113', 'capital', 'sobha aranya', 'deluxe dxp'];
        return dxp.some(k => fullText.includes(k));
      }
      if (qn === 'dlf') return fullText.includes('dlf');
      if (qn === 'nirvana') return fullText.includes('nirvana') || fullText.includes('sector 50') || fullText.includes('south city 2');
      return fullText.includes(qn);
    }

    function matchesCategory(o, cat) {
      if (!cat) return true;
      const t = norm([o.property_type, o.configuration, o.listing_title].join(' '));
      if (cat === 'builder-floor') return t.includes('builder floor') || t.includes('floor');
      if (cat === 'plot') return t.includes('plot') || t.includes('land');
      if (cat === 'Commercial') return t.includes('commercial') || t.includes('office') || t.includes('shop');
      if (cat === 'Villa') return t.includes('villa') || t.includes('kothi') || t.includes('house');
      if (cat === 'Apartment') return t.includes('apartment') || t.includes('condo') || t.includes('flat');
      return true;
    }

    function matchesBudget(o, b) {
      if (!b) return true;
      const p = Number(o.price_value);
      if (!p) return true;
      if (b === '< 3 Cr') return p < 3;
      if (b === '3–7 Cr') return p >= 3 && p <= 7;
      if (b === '7–15 Cr') return p >= 7 && p <= 15;
      if (b === '15–30 Cr') return p >= 15 && p <= 30;
      if (b === '30+ Cr') return p >= 30;
      return true;
    }

    function filterData(intent, loc, cat, budget) {
      return INVENTORY.filter(o => {
        // Intent
        const tx = norm(o.transaction_type || '');
        const ptype = norm(o.property_type || '');
        if (intent === 'buy' && tx.includes('rent')) return false;
        if (intent === 'rent' && !tx.includes('rent') && !tx.includes('lease')) return false;
        if (intent === 'commercial' && !ptype.includes('commercial') && !ptype.includes('office') && !ptype.includes('shop')) return false;
        if (intent === 'land' && !ptype.includes('plot') && !ptype.includes('land')) return false;

        return matchesCorridor(o, loc) && matchesCategory(o, cat) && matchesBudget(o, budget);
      });
    }

    // View switcher
    function showView(viewName, params = {}) {
      ['viewHome', 'viewBrowse', 'viewDetail', 'viewLocations', 'viewAbout'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
      });

      // Update active nav button
      ['navHome', 'navBrowse', 'navLocations', 'navAbout'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.classList.remove('text-[#7A303B]', 'border-b-2', 'border-[#7A303B]');
        }
      });

      if (viewName === 'home') {
        document.getElementById('viewHome').classList.remove('hidden');
        document.getElementById('navHome').classList.add('text-[#7A303B]', 'border-b-2', 'border-[#7A303B]');
      } else if (viewName === 'browse') {
        document.getElementById('viewBrowse').classList.remove('hidden');
        document.getElementById('navBrowse').classList.add('text-[#7A303B]', 'border-b-2', 'border-[#7A303B]');
        if (params.intent) document.getElementById('filterIntent').value = params.intent;
        if (params.location !== undefined) document.getElementById('filterLocation').value = params.location;
        applyFilters();
      } else if (viewName === 'detail') {
        document.getElementById('viewDetail').classList.remove('hidden');
        renderDetail(params.id);
      } else if (viewName === 'locations') {
        document.getElementById('viewLocations').classList.remove('hidden');
        document.getElementById('navLocations').classList.add('text-[#7A303B]', 'border-b-2', 'border-[#7A303B]');
        renderCorridors();
      } else if (viewName === 'about') {
        document.getElementById('viewAbout').classList.remove('hidden');
        document.getElementById('navAbout').classList.add('text-[#7A303B]', 'border-b-2', 'border-[#7A303B]');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function triggerQuickSearch() {
      const intent = document.getElementById('quickIntent').value;
      const loc = document.getElementById('quickLocation').value;
      showView('browse', { intent, location: loc });
    }

    function applyFilters() {
      const intent = document.getElementById('filterIntent').value;
      const loc = document.getElementById('filterLocation').value;
      const cat = document.getElementById('filterType').value;
      const budget = document.getElementById('filterBudget').value;

      currentFilteredList = filterData(intent, loc, cat, budget);
      
      const countBadge = document.getElementById('resultCountBadge');
      countBadge.textContent = currentFilteredList.length + ' verified ' + (currentFilteredList.length === 1 ? 'property' : 'properties');

      const browseTitle = document.getElementById('browseTitle');
      browseTitle.textContent = intent === 'commercial' ? 'Commercial & retail mandates.' :
        intent === 'land' ? 'Residential plots & freehold land.' :
        intent === 'rent' ? 'Executive leasing & rentals.' : 'Find your next residence.';

      const grid = document.getElementById('resultsGrid');
      const empty = document.getElementById('emptyState');

      if (currentFilteredList.length === 0) {
        grid.innerHTML = '';
        grid.classList.add('hidden');
        empty.classList.remove('hidden');
        return;
      }

      empty.classList.add('hidden');
      grid.classList.remove('hidden');

      grid.innerHTML = currentFilteredList.slice(0, 30).map(o => {
        const title = cleanTitle(o.listing_title || o.project_name);
        const locLabel = [o.locality, o.sector, o.city].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', ') || 'Gurgaon';
        const price = formatPrice(o);
        const config = [o.configuration, o.bedrooms ? (o.bedrooms + ' BHK') : '', o.area_value ? (o.area_value + ' ' + (o.area_unit || '')) : ''].filter(Boolean).join(' · ');

        return \`
          <article class="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between group">
            <div class="h-44 bg-gradient-to-tr from-slate-900 to-slate-700 relative p-3 flex flex-col justify-between">
              <div class="flex justify-between items-start">
                <span class="px-2 py-0.5 rounded bg-black/60 text-white font-mono text-[10px] tracking-wider uppercase border border-white/20">
                  \${o.property_type || 'Property'}
                </span>
                <span class="text-[10px] font-mono text-slate-300">\${o.property_id}</span>
              </div>
              <div>
                <span class="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">Verified Mandate</span>
                <span class="text-xs text-white/90 font-medium">\${locLabel}</span>
              </div>
            </div>

            <div class="p-4 flex-1 flex flex-col justify-between">
              <div>
                <h3 class="font-bold text-sm text-slate-900 leading-snug group-hover:text-[#7A303B] transition mb-1">\${title}</h3>
                <p class="text-xs text-slate-500 mb-2 font-medium">\${config || 'Verified specifications'}</p>
                <p class="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-4">\${o.public_description || o.key_features || 'Particulars available on advisory desk request.'}</p>
              </div>

              <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div class="font-bold text-sm font-mono text-[#7A303B]">\${price}</div>
                <div class="flex items-center gap-1.5">
                  <button onclick="showView('detail', {id:'\${o.property_id}'})" class="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition">
                    Dossier ↗
                  </button>
                  <button onclick="openWhatsAppModal('\${title.replace(/'/g, "\\\\'")}', '\${o.property_id}', '\${locLabel.replace(/'/g, "\\\\'")}', '\${price.replace(/'/g, "\\\\'")}')" class="px-2.5 py-1 rounded bg-[#7A303B] hover:bg-[#5E242E] text-white text-xs font-semibold transition">
                    Inquire ↗
                  </button>
                </div>
              </div>
            </div>
          </article>
        \`;
      }).join('');
    }

    function resetAllFilters() {
      document.getElementById('filterIntent').value = 'buy';
      document.getElementById('filterLocation').value = '';
      document.getElementById('filterType').value = '';
      document.getElementById('filterBudget').value = '';
      applyFilters();
    }

    function renderDetail(id) {
      const item = INVENTORY.find(x => x.property_id === id) || INVENTORY[0];
      const title = cleanTitle(item.listing_title || item.project_name);
      const loc = [item.locality, item.sector, item.city].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', ') || 'Gurgaon';
      const price = formatPrice(item);

      document.getElementById('dtRef').textContent = 'REF / ' + item.property_id;
      document.getElementById('dtTitle').textContent = title;
      document.getElementById('dtLocation').textContent = loc;
      document.getElementById('dtPrice').textContent = price;
      document.getElementById('dtDesc').textContent = item.public_description || item.key_features || 'Verified specifications and title deeds on file at Nirvana Courtyard advisory office.';

      const specs = [
        ['Property Type', item.property_type],
        ['Configuration', item.configuration],
        ['Bedrooms', item.bedrooms ? item.bedrooms + ' BHK' : 'N/A'],
        ['Area', item.area_value ? item.area_value + ' ' + (item.area_unit || '') : 'Disclosed on visit'],
        ['Facing', item.facing || 'Park / North-East'],
        ['Road Width', item.road_width || 'Standard Sector Road'],
        ['Transaction', item.transaction_type || 'Sale'],
        ['Status', item.status || 'Available']
      ];

      document.getElementById('dtSpecs').innerHTML = specs.map(([k, v]) => \`
        <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <span class="text-[10px] text-slate-400 font-bold uppercase block">\${k}</span>
          <strong class="text-xs text-slate-800 block truncate">\${v}</strong>
        </div>
      \`).join('');

      document.getElementById('dtWhatsAppBtn').onclick = () => openWhatsAppModal(title, item.property_id, loc, price);
    }

    function renderCorridors() {
      const corridors = [
        { name: 'Golf Course Road & DLF 5', sub: 'The Camellias, Magnolias, Aralias, Belaire', filter: 'Golf Course Road' },
        { name: 'DLF Phase 1–5', sub: 'Independent Luxury Floors & Freehold Plots', filter: 'DLF' },
        { name: 'Golf Course Extn & SPR', sub: 'The Arbour, Conscient Elevate, Grand Arch', filter: 'Golf Course Ext Road' },
        { name: 'Nirvana Country & Sector 50', sub: 'Low-Density Family Villas & AUM Estates HQ', filter: 'Nirvana' },
        { name: 'Dwarka Expressway (DXP)', sub: 'Airport Link Corridor, Sobha Aranya, M3M Capital', filter: 'Dwarka Expressway' },
        { name: 'Sohna Road Corridor', sub: 'Established Residential Township & Central Park', filter: 'Sohna Road' }
      ];

      document.getElementById('corridorCards').innerHTML = corridors.map(c => {
        const count = INVENTORY.filter(o => matchesCorridor(o, c.filter)).length;
        return \`
          <div onclick="showView('browse', {location:'\${c.filter}'})" class="bg-white p-5 rounded-xl border border-slate-200 hover:border-[#7A303B] hover:shadow-md cursor-pointer transition flex flex-col justify-between group">
            <div>
              <div class="flex justify-between items-start text-xs font-mono text-slate-400 mb-2">
                <span>CORRIDOR</span>
                <span class="font-bold text-[#7A303B] group-hover:translate-x-1 group-hover:-translate-y-1 transition">↗</span>
              </div>
              <h3 class="font-bold text-base text-slate-900 leading-snug mb-1 group-hover:text-[#7A303B] transition">\${c.name}</h3>
              <p class="text-xs text-slate-500 mb-4">\${c.sub}</p>
            </div>
            <div class="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span class="font-mono font-bold text-slate-700">\${count} Verified Listings</span>
              <span class="font-bold text-[#7A303B]">Explore →</span>
            </div>
          </div>
        \`;
      }).join('');
    }

    function openWhatsAppModal(title, id, loc, price) {
      const msg = \`Hi Ajay, I am interested in \${title} (Ref: \${id}) in \${loc}, listed around \${price}. Please share the complete dossier.\`;
      document.getElementById('waMessageText').textContent = msg;
      document.getElementById('waExternalLink').href = 'https://wa.me/919873813595?text=' + encodeURIComponent(msg);
      document.getElementById('waModal').classList.remove('hidden');
    }

    function closeWhatsAppModal() {
      document.getElementById('waModal').classList.add('hidden');
    }

    function setViewport(mode) {
      const frame = document.getElementById('simFrame');
      ['vpDesktop', 'vpTablet', 'vpMobile'].forEach(id => {
        document.getElementById(id).classList.remove('bg-slate-800', 'text-white');
        document.getElementById(id).classList.add('text-slate-400');
      });

      if (mode === 'desktop') {
        frame.style.maxWidth = '100%';
        document.getElementById('vpDesktop').classList.add('bg-slate-800', 'text-white');
      } else if (mode === 'tablet') {
        frame.style.maxWidth = '768px';
        document.getElementById('vpTablet').classList.add('bg-slate-800', 'text-white');
      } else if (mode === 'mobile') {
        frame.style.maxWidth = '390px';
        document.getElementById('vpMobile').classList.add('bg-slate-800', 'text-white');
      }
    }

    function setPresentation(mode) {
      const ribbon = document.getElementById('studyRibbon');
      if (mode === 'study') {
        ribbon.classList.remove('hidden');
        document.getElementById('modeStudy').classList.add('bg-red-600', 'text-white');
        document.getElementById('modeVisitor').classList.remove('bg-red-600', 'text-white');
        document.getElementById('modeVisitor').classList.add('text-slate-400');
      } else {
        ribbon.classList.add('hidden');
        document.getElementById('modeVisitor').classList.add('bg-red-600', 'text-white');
        document.getElementById('modeStudy').classList.remove('bg-red-600', 'text-white');
        document.getElementById('modeStudy').classList.add('text-slate-400');
      }
    }

    // Initialize
    applyFilters();
  </script>
</body>
</html>
`;

if (fs.existsSync(ARTIFACT_DIR)) {
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'simulator.html'), htmlContent, 'utf8');
  console.log('Successfully wrote interactive simulator to:', path.join(ARTIFACT_DIR, 'simulator.html'));
}
const hostingerSim = path.join(ROOT_DIR, 'AUM_ESTATES_Website_For_Hostinger', 'simulator.html');
fs.writeFileSync(hostingerSim, htmlContent, 'utf8');
console.log('Successfully wrote interactive simulator to:', hostingerSim);
