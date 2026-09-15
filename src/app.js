// Controlador principal de la aplicación (TurnoYa - Directorio & Reservas)
import { storage } from './services/storage.js';

class App {
  constructor() {
    this.currentView = 'directory'; // 'directory' | 'business-detail' | 'owner-dashboard'
    this.selectedBusinessId = null;
    this.selectedCategory = 'all';
    this.searchQuery = '';
    
    // Estado del modal de reserva
    this.bookingState = {
      isOpen: false,
      businessId: null,
      serviceId: null,
      selectedDate: this.getTodayDateString(),
      selectedTime: null
    };

    // Estado del panel de dueño
    this.activeDashboardTab = 'appointments'; // 'appointments' | 'services' | 'profile' | 'schedule'
  }

  getTodayDateString() {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  formatColones(amount) {
    const num = Number(amount) || 0;
    return '₡' + num.toLocaleString('es-CR', { maximumFractionDigits: 0 });
  }

  init() {
    this.renderHeader();
    this.renderCurrentView();
    this.setupGlobalEvents();
  }

  // --- NAVEGACIÓN ---
  navigateTo(view, params = {}) {
    this.currentView = view;
    if (params.businessId) {
      this.selectedBusinessId = params.businessId;
    }
    this.renderHeader();
    this.renderCurrentView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- NOTIFICACIONES TOAST ---
  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const bgClass = type === 'success' ? 'bg-emerald-600 text-white' : type === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-white';
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';

    toast.className = `flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl ${bgClass} animate-fade-in transition-all duration-300 font-medium text-sm`;
    toast.innerHTML = `<i class="fas ${icon} text-lg"></i> <span>${message}</span>`;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // --- HEADER / NAVBAR ---
  renderHeader() {
    const headerContainer = document.getElementById('navbar-container');
    if (!headerContainer) return;

    headerContainer.innerHTML = `
      <header class="sticky top-0 z-40 glass-header border-b border-slate-200/80 shadow-xs">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <!-- Logo -->
          <div class="flex items-center gap-3 cursor-pointer select-none" id="nav-logo-btn">
            <div class="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <i class="fas fa-calendar-check text-xl"></i>
            </div>
            <div>
              <span class="font-extrabold text-xl tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">TurnoYa</span>
              <span class="text-xs block text-slate-500 font-medium">Directorio & Reservas Costa Rica 🇨🇷</span>
            </div>
          </div>

          <!-- Navigation Links -->
          <nav class="flex items-center gap-2 sm:gap-3">
            <button id="nav-directory-btn" class="px-4 py-2 rounded-xl text-sm font-semibold transition-all ${this.currentView === 'directory' || this.currentView === 'business-detail' ? 'bg-blue-50 text-blue-700 shadow-xs' : 'text-slate-600 hover:bg-slate-100'}">
              <i class="fas fa-compass mr-1.5"></i> Explorar
            </button>

            <button id="nav-register-btn" class="hidden sm:flex items-center px-3.5 py-2 rounded-xl text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-all">
              <i class="fas fa-plus-circle mr-1.5"></i> Registrar Negocio
            </button>

            <button id="nav-dashboard-btn" class="px-4 py-2 rounded-xl text-sm font-semibold transition-all ${this.currentView === 'owner-dashboard' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25' : 'bg-slate-900 hover:bg-slate-800 text-white'}">
              <i class="fas fa-store mr-1.5"></i> Panel Dueño
            </button>
          </nav>
        </div>
      </header>
    `;

    document.getElementById('nav-logo-btn')?.addEventListener('click', () => this.navigateTo('directory'));
    document.getElementById('nav-directory-btn')?.addEventListener('click', () => this.navigateTo('directory'));
    document.getElementById('nav-dashboard-btn')?.addEventListener('click', () => this.navigateTo('owner-dashboard'));
    document.getElementById('nav-register-btn')?.addEventListener('click', () => this.renderNewBusinessModal());
  }

  // --- GESTIÓN DE VISTAS ---
  renderCurrentView() {
    const main = document.getElementById('main-content');
    if (!main) return;

    switch (this.currentView) {
      case 'directory':
        this.renderDirectoryView(main);
        break;
      case 'business-detail':
        this.renderBusinessDetailView(main);
        break;
      case 'owner-dashboard':
        this.renderOwnerDashboardView(main);
        break;
      default:
        this.renderDirectoryView(main);
    }
  }

  // ==========================================
  // VISTA 1: DIRECTORIO DE NEGOCIOS (CLIENTE)
  // ==========================================
  renderDirectoryView(container) {
    const categories = storage.getCategories();
    let businesses = storage.getBusinesses();

    // Filtros
    if (this.selectedCategory !== 'all') {
      businesses = businesses.filter(b => b.category === this.selectedCategory);
    }
    if (this.searchQuery.trim() !== '') {
      const q = this.searchQuery.toLowerCase();
      businesses = businesses.filter(b => 
        b.name.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.city.toLowerCase().includes(q) ||
        (b.services && b.services.some(s => s.name.toLowerCase().includes(q)))
      );
    }

    container.innerHTML = `
      <div class="animate-fade-in pb-20">
        <!-- Hero Section -->
        <section class="relative bg-gradient-to-b from-blue-50/70 via-white to-slate-50 border-b border-slate-200/70 py-16 px-4 sm:px-6 lg:px-8">
          <div class="max-w-4xl mx-auto text-center">
            <span class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100/80 text-blue-700 text-xs font-bold uppercase tracking-wider mb-4">
              <i class="fas fa-bolt text-blue-600"></i> Reserva tu turno en línea en Costa Rica
            </span>
            <h1 class="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Encuentra los mejores comercios y <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">agenda tu cita al instante</span>
            </h1>
            <p class="mt-4 text-slate-600 text-base sm:text-lg max-w-2xl mx-auto">
              Barberías, spas, dentistas, talleres mecánicos y más en colones (₡ CRC). Selecciona tu horario ideal sin llamadas.
            </p>

            <!-- Search Bar -->
            <div class="mt-8 max-w-2xl mx-auto relative flex items-center shadow-xl rounded-2xl bg-white border border-slate-200 p-2">
              <div class="pl-4 text-slate-400">
                <i class="fas fa-search text-lg"></i>
              </div>
              <input 
                type="text" 
                id="search-input" 
                value="${this.searchQuery}" 
                placeholder="Busca por servicio ('corte', 'masaje', 'dentista', 'frenos') o cantón..." 
                class="w-full px-4 py-3 text-slate-800 placeholder-slate-400 bg-transparent text-sm sm:text-base focus:outline-none"
              />
              ${this.searchQuery ? `
                <button id="clear-search-btn" class="p-2 text-slate-400 hover:text-slate-600 mr-2">
                  <i class="fas fa-times-circle"></i>
                </button>
              ` : ''}
              <button id="do-search-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-md shadow-blue-500/20 text-sm">
                Buscar
              </button>
            </div>
          </div>
        </section>

        <!-- Category Filter Pills -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          <div class="flex items-center gap-2 overflow-x-auto pb-4 no-scrollbar">
            ${categories.map(cat => `
              <button 
                class="category-pill-btn flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${this.selectedCategory === cat.id ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'}"
                data-category-id="${cat.id}"
              >
                <i class="fas ${cat.icon} text-sm"></i>
                <span>${cat.name}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Business Cards Grid -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-bold text-slate-900">
              ${this.selectedCategory === 'all' ? 'Todos los Establecimientos' : categories.find(c => c.id === this.selectedCategory)?.name || 'Negocios'} 
              <span class="text-sm font-normal text-slate-500 ml-2">(${businesses.length} disponibles)</span>
            </h2>
          </div>

          ${businesses.length === 0 ? `
            <div class="text-center py-20 bg-white rounded-3xl border border-slate-200 p-8 max-w-md mx-auto">
              <div class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mx-auto mb-4 text-2xl">
                <i class="fas fa-search"></i>
              </div>
              <h3 class="text-lg font-bold text-slate-800">No encontramos resultados</h3>
              <p class="text-sm text-slate-500 mt-1">Prueba con otra palabra clave o selecciona otra categoría.</p>
              <button id="reset-filter-btn" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
                Ver todos los negocios
              </button>
            </div>
          ` : `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              ${businesses.map(biz => `
                <div class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col group hover:-translate-y-1 relative">
                  <!-- Image Header -->
                  <div class="relative h-52 overflow-hidden bg-slate-100">
                    <img src="${biz.image || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80'}" alt="${biz.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30"></div>
                    
                    <!-- Badge COMERCIO DE MUESTRA o VERIFICADO -->
                    <div class="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
                      ${biz.isDemo ? `
                        <span class="bg-purple-700/90 text-white backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-extrabold flex items-center gap-1 shadow-md border border-purple-400/40">
                          <i class="fas fa-flask text-purple-200"></i> Comercio de Muestra
                        </span>
                      ` : `
                        <span class="bg-emerald-600/90 text-white backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-extrabold flex items-center gap-1 shadow-md">
                          <i class="fas fa-check-circle text-emerald-200"></i> Comercio Registrado
                        </span>
                      `}
                      <span class="bg-white/95 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[11px] font-bold text-slate-800 shadow-sm">
                        ${biz.categoryLabel}
                      </span>
                    </div>

                    <!-- Rating -->
                    <span class="absolute top-3 right-3 bg-amber-400 text-slate-900 px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-1 shadow-sm">
                      <i class="fas fa-star text-xs"></i> ${biz.rating || 5.0} <span class="text-slate-700 font-normal">(${biz.reviewsCount || 0})</span>
                    </span>

                    <div class="absolute bottom-3 left-3 right-3 text-white">
                      <span class="text-xs font-semibold text-slate-200 flex items-center gap-1">
                        <i class="fas fa-map-marker-alt text-rose-400"></i> ${biz.city}
                      </span>
                    </div>
                  </div>

                  <!-- Content Body -->
                  <div class="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 class="font-bold text-lg text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                        ${biz.name}
                      </h3>
                      <p class="text-xs text-slate-500 mt-1 line-clamp-2">
                        ${biz.description}
                      </p>

                      <!-- Features pills preview -->
                      ${biz.features && biz.features.length > 0 ? `
                        <div class="flex flex-wrap gap-1.5 mt-3">
                          ${biz.features.slice(0, 3).map(feat => `
                            <span class="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                              ${feat}
                            </span>
                          `).join('')}
                          ${biz.features.length > 3 ? `<span class="text-[10px] text-slate-400">+${biz.features.length - 3}</span>` : ''}
                        </div>
                      ` : ''}

                      <!-- Schedule info -->
                      <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                        <span class="flex items-center gap-1.5 font-medium">
                          <i class="far fa-clock text-blue-600"></i> 
                          ${biz.schedule ? `${biz.schedule.openTime} - ${biz.schedule.closeTime}` : '08:00 - 18:00'}
                        </span>
                        <span class="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                          ${biz.services ? biz.services.length : 0} servicios disp.
                        </span>
                      </div>
                    </div>

                    <!-- Action Button -->
                    <div class="mt-5 pt-3">
                      <button 
                        class="view-biz-btn w-full py-2.5 px-4 bg-slate-900 hover:bg-blue-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                        data-business-id="${biz.id}"
                      >
                        <span>Ver Servicios & Reservar</span>
                        <i class="fas fa-arrow-right text-xs"></i>
                      </button>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    `;

    // Listeners
    const searchInput = document.getElementById('search-input');
    const doSearchBtn = document.getElementById('do-search-btn');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const resetFilterBtn = document.getElementById('reset-filter-btn');

    const handleSearch = () => {
      this.searchQuery = searchInput.value;
      this.renderCurrentView();
    };

    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSearch();
    });
    doSearchBtn?.addEventListener('click', handleSearch);
    clearSearchBtn?.addEventListener('click', () => {
      this.searchQuery = '';
      this.renderCurrentView();
    });
    resetFilterBtn?.addEventListener('click', () => {
      this.searchQuery = '';
      this.selectedCategory = 'all';
      this.renderCurrentView();
    });

    // Filtros de categoría
    document.querySelectorAll('.category-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedCategory = btn.getAttribute('data-category-id');
        this.renderCurrentView();
      });
    });

    // Botones de Ver Negocio
    document.querySelectorAll('.view-biz-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const bId = btn.getAttribute('data-business-id');
        this.navigateTo('business-detail', { businessId: bId });
      });
    });
  }

  // ==========================================
  // VISTA 2: DETALLE DEL NEGOCIO & SERVICIOS
  // ==========================================
  renderBusinessDetailView(container) {
    const biz = storage.getBusinessById(this.selectedBusinessId);
    if (!biz) {
      this.navigateTo('directory');
      return;
    }

    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const activeDaysText = biz.schedule && biz.schedule.days ? biz.schedule.days.map(d => dayNames[d]).join(', ') : 'Lunes a Sábado';

    container.innerHTML = `
      <div class="animate-fade-in pb-20">
        <!-- Cover Banner Hero -->
        <div class="relative bg-slate-900 h-64 sm:h-96 w-full overflow-hidden">
          <img src="${biz.coverImage || biz.image}" alt="${biz.name}" class="w-full h-full object-cover opacity-60">
          <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-transparent"></div>

          <div class="absolute top-6 left-4 sm:left-8 z-10">
            <button id="back-to-directory-btn" class="px-4 py-2 rounded-xl bg-white/90 hover:bg-white text-slate-800 text-sm font-bold flex items-center gap-2 shadow-lg backdrop-blur-md transition-all">
              <i class="fas fa-arrow-left"></i> Volver al Directorio
            </button>
          </div>

          <div class="absolute bottom-6 left-4 sm:left-8 right-4 sm:right-8 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 text-white">
            <div class="space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                ${biz.isDemo ? `
                  <span class="px-3 py-1 rounded-full bg-purple-600 text-white text-xs font-black uppercase tracking-wider shadow-md">
                    <i class="fas fa-flask mr-1"></i> Comercio de Muestra
                  </span>
                ` : `
                  <span class="px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-black uppercase tracking-wider shadow-md">
                    <i class="fas fa-check-circle mr-1"></i> Comercio Registrado
                  </span>
                `}
                <span class="px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-bold uppercase tracking-wider">
                  ${biz.categoryLabel}
                </span>
                <span class="bg-amber-400 text-slate-900 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                  <i class="fas fa-star text-xs"></i> ${biz.rating || 5.0} (${biz.reviewsCount || 0} opiniones)
                </span>
              </div>
              <h1 class="text-2xl sm:text-4xl font-extrabold tracking-tight">${biz.name}</h1>
              <p class="text-sm text-slate-300 flex items-center gap-1.5">
                <i class="fas fa-map-marker-alt text-rose-400"></i> ${biz.address}, ${biz.city}
              </p>
            </div>
          </div>
        </div>

        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- Columna Izquierda: Servicios y Catálogo (2 cols) -->
          <div class="lg:col-span-2 space-y-6">
            <!-- Servicios -->
            <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
              <h2 class="text-xl font-bold text-slate-900 mb-2">Servicios Disponibles</h2>
              <p class="text-sm text-slate-500 mb-6">Selecciona el servicio que deseas en colones (₡) para ver turnos disponibles y agendar.</p>

              <div class="space-y-4">
                ${biz.services && biz.services.length > 0 ? biz.services.map(srv => `
                  <div class="p-5 rounded-2xl border border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div class="flex-1">
                      <div class="flex items-center gap-3">
                        <h3 class="font-bold text-base text-slate-900">${srv.name}</h3>
                        <span class="px-2.5 py-0.5 rounded-full bg-slate-200/80 text-slate-700 text-xs font-semibold">
                          <i class="far fa-clock mr-1 text-slate-500"></i>${srv.duration} min
                        </span>
                      </div>
                      <p class="text-xs text-slate-500 mt-1.5">${srv.description || 'Sin descripción detallada'}</p>
                    </div>

                    <div class="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3">
                      <span class="text-lg font-extrabold text-blue-600">${this.formatColones(srv.price)}</span>
                      <button 
                        class="book-service-btn px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center gap-1.5"
                        data-service-id="${srv.id}"
                      >
                        <i class="fas fa-calendar-plus"></i> Reservar
                      </button>
                    </div>
                  </div>
                `).join('') : `
                  <p class="text-sm text-slate-400 py-4">Este comercio aún no tiene servicios agregados.</p>
                `}
              </div>
            </div>

            <!-- Características y Amenidades -->
            ${biz.features && biz.features.length > 0 ? `
              <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
                <h2 class="text-lg font-bold text-slate-900 mb-4">Comodidades y Métodos de Pago</h2>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  ${biz.features.map(feat => `
                    <div class="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700">
                      <i class="fas fa-check text-emerald-600 text-sm"></i>
                      <span>${feat}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- Sobre Nosotros -->
            <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
              <h2 class="text-lg font-bold text-slate-900 mb-3">Sobre el Establecimiento</h2>
              <p class="text-sm text-slate-600 leading-relaxed">${biz.description || 'Sin descripción registrada.'}</p>
            </div>
          </div>

          <!-- Columna Derecha: Información de Contacto y Horarios (1 col) -->
          <div class="space-y-6">
            <!-- Contact Box -->
            <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 class="font-bold text-base text-slate-900">Contacto Directo</h3>
              
              <div class="space-y-3 text-sm">
                <div class="flex items-center gap-3 text-slate-600">
                  <div class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <i class="fas fa-phone-alt text-xs"></i>
                  </div>
                  <span>${biz.phone}</span>
                </div>

                <div class="flex items-center gap-3 text-slate-600">
                  <div class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                    <i class="fas fa-envelope text-xs"></i>
                  </div>
                  <span class="truncate">${biz.email || 'No especificado'}</span>
                </div>

                <div class="flex items-center gap-3 text-slate-600">
                  <div class="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                    <i class="fas fa-map-pin text-xs"></i>
                  </div>
                  <span>${biz.address}</span>
                </div>
              </div>

              ${biz.phone ? `
                <div class="pt-4 border-t border-slate-100">
                  <a href="https://wa.me/${biz.phone.replace(/[^0-9]/g, '')}" target="_blank" class="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors">
                    <i class="fab fa-whatsapp text-sm"></i> Chatear por WhatsApp
                  </a>
                </div>
              ` : ''}
            </div>

            <!-- Schedule Box -->
            <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
              <h3 class="font-bold text-base text-slate-900 mb-3 flex items-center gap-2">
                <i class="far fa-clock text-blue-600"></i> Horario de Atención
              </h3>

              <div class="space-y-2 text-xs text-slate-600">
                <div class="flex justify-between py-1.5 border-b border-slate-100">
                  <span class="font-medium">Días laborales:</span>
                  <span class="font-bold text-slate-800 text-right">${activeDaysText}</span>
                </div>
                <div class="flex justify-between py-1.5 border-b border-slate-100">
                  <span class="font-medium">Horario de atención:</span>
                  <span class="font-bold text-slate-800">${biz.schedule ? `${biz.schedule.openTime} - ${biz.schedule.closeTime}` : '08:00 - 18:00'}</span>
                </div>
                ${biz.schedule && biz.schedule.breakStart ? `
                  <div class="flex justify-between py-1.5 text-amber-700 bg-amber-50 px-2 rounded-lg">
                    <span class="font-medium">Receso / Almuerzo:</span>
                    <span class="font-bold">${biz.schedule.breakStart} - ${biz.schedule.breakEnd}</span>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('back-to-directory-btn')?.addEventListener('click', () => this.navigateTo('directory'));

    document.querySelectorAll('.book-service-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sId = btn.getAttribute('data-service-id');
        this.openBookingModal(biz.id, sId);
      });
    });
  }

  // ==========================================
  // MODAL DE RESERVA EN TIEMPO REAL
  // ==========================================
  openBookingModal(businessId, serviceId) {
    this.bookingState = {
      isOpen: true,
      businessId,
      serviceId,
      selectedDate: this.getTodayDateString(),
      selectedTime: null
    };
    this.renderBookingModal();
  }

  closeBookingModal() {
    this.bookingState.isOpen = false;
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) modalContainer.innerHTML = '';
  }

  renderBookingModal() {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer || !this.bookingState.isOpen) return;

    const biz = storage.getBusinessById(this.bookingState.businessId);
    const service = biz?.services.find(s => s.id === this.bookingState.serviceId) || biz?.services[0];
    if (!biz || !service) return;

    // Calcular franjas horarias disponibles para la fecha seleccionada
    const availability = storage.getAvailableSlots(biz.id, this.bookingState.selectedDate, service.duration);

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop animate-fade-in overflow-y-auto">
        <div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 my-8">
          <!-- Header -->
          <div class="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white flex items-center justify-between">
            <div>
              <span class="text-xs uppercase tracking-wider text-blue-200 font-bold">Reserva de Turno</span>
              <h3 class="text-xl font-bold">${biz.name}</h3>
            </div>
            <button id="close-modal-btn" class="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <!-- Body -->
          <div class="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
            <!-- Servicio seleccionado -->
            <div class="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span class="text-xs text-blue-600 font-semibold uppercase">Servicio</span>
                <h4 class="font-bold text-slate-900">${service.name}</h4>
                <span class="text-xs text-slate-500"><i class="far fa-clock mr-1"></i>${service.duration} minutos</span>
              </div>
              <div class="text-right">
                <span class="text-lg font-black text-blue-700">${this.formatColones(service.price)}</span>
              </div>
            </div>

            <!-- Paso 1: Seleccionar Fecha -->
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                1. Selecciona la Fecha
              </label>
              <input 
                type="date" 
                id="booking-date-input" 
                value="${this.bookingState.selectedDate}" 
                min="${this.getTodayDateString()}" 
                class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <!-- Paso 2: Horarios Disponibles en Tiempo Real -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  2. Horario Disponible (${availability.slots ? availability.slots.length : 0} libres)
                </label>
              </div>

              ${availability.isClosed ? `
                <div class="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-2">
                  <i class="fas fa-calendar-times text-base"></i>
                  <span>${availability.reason}</span>
                </div>
              ` : availability.slots.length === 0 ? `
                <div class="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs flex items-center gap-2">
                  <i class="fas fa-info-circle text-base"></i>
                  <span>No hay turnos disponibles para esta fecha. Intenta con otro día.</span>
                </div>
              ` : `
                <div class="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto p-1">
                  ${availability.slots.map(slot => `
                    <button 
                      type="button" 
                      class="time-slot-btn py-2.5 px-3 text-xs font-bold rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50 text-slate-700 text-center ${this.bookingState.selectedTime === slot ? 'selected' : ''}"
                      data-slot="${slot}"
                    >
                      <i class="far fa-clock mr-1 text-[10px]"></i>${slot}
                    </button>
                  `).join('')}
                </div>
              `}
            </div>

            <!-- Paso 3: Datos de Contacto -->
            <form id="booking-form" class="space-y-3 pt-3 border-t border-slate-100">
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                3. Tus Datos para la Reserva
              </label>

              <div>
                <input 
                  type="text" 
                  id="client-name" 
                  placeholder="Nombre y Apellidos *" 
                  required 
                  class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input 
                  type="tel" 
                  id="client-phone" 
                  placeholder="Teléfono / WhatsApp (+506) *" 
                  required 
                  class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <input 
                  type="email" 
                  id="client-email" 
                  placeholder="Correo Electrónico" 
                  class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <textarea 
                  id="client-notes" 
                  placeholder="Notas adicionales o preferencias (opcional)" 
                  rows="2" 
                  class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                ></textarea>
              </div>

              <!-- Submit button -->
              <button 
                type="submit" 
                id="submit-booking-btn"
                ${!this.bookingState.selectedTime ? 'disabled' : ''}
                class="w-full mt-4 py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-bold shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
              >
                <i class="fas fa-check-circle"></i>
                <span>Confirmar Reserva ${this.bookingState.selectedTime ? `(${this.bookingState.selectedTime})` : ''}</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    `;

    // Listeners del modal
    document.getElementById('close-modal-btn')?.addEventListener('click', () => this.closeBookingModal());

    const dateInput = document.getElementById('booking-date-input');
    dateInput?.addEventListener('change', (e) => {
      this.bookingState.selectedDate = e.target.value;
      this.bookingState.selectedTime = null;
      this.renderBookingModal();
    });

    document.querySelectorAll('.time-slot-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.bookingState.selectedTime = btn.getAttribute('data-slot');
        this.renderBookingModal();
      });
    });

    // Envío del formulario de reserva
    const form = document.getElementById('booking-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!this.bookingState.selectedTime) {
        this.showToast('Por favor selecciona una hora disponible.', 'error');
        return;
      }

      const clientName = document.getElementById('client-name').value;
      const clientPhone = document.getElementById('client-phone').value;
      const clientEmail = document.getElementById('client-email').value;
      const clientNotes = document.getElementById('client-notes').value;

      const newAppointment = await storage.createAppointment({
        businessId: biz.id,
        serviceId: service.id,
        serviceName: service.name,
        servicePrice: service.price,
        serviceDuration: service.duration,
        date: this.bookingState.selectedDate,
        time: this.bookingState.selectedTime,
        clientName,
        clientPhone,
        clientEmail,
        notes: clientNotes,
        status: 'confirmed'
      });

      this.closeBookingModal();
      this.renderSuccessBookingModal(newAppointment, biz);
      this.showToast('¡Reserva confirmada con éxito!', 'success');
    });
  }

  // --- MODAL DE ÉXITO DE RESERVA ---
  renderSuccessBookingModal(appointment, business) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop animate-fade-in">
        <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 text-center p-6 sm:p-8">
          <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 animate-bounce">
            <i class="fas fa-check"></i>
          </div>

          <span class="text-xs uppercase font-extrabold text-emerald-600 tracking-wider">¡Turno Agendado!</span>
          <h3 class="text-2xl font-black text-slate-900 mt-1">Cita Confirmada</h3>
          <p class="text-xs text-slate-500 mt-1">Código de reserva: <strong class="text-slate-800 font-mono">${appointment.id.toUpperCase()}</strong></p>

          <!-- Ticket resumen -->
          <div class="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left text-xs space-y-2.5">
            <div class="flex justify-between">
              <span class="text-slate-500">Establecimiento:</span>
              <span class="font-bold text-slate-800">${business.name}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Servicio:</span>
              <span class="font-bold text-slate-800">${appointment.serviceName}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Fecha y Hora:</span>
              <span class="font-bold text-blue-600">${appointment.date} a las ${appointment.time}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Cliente:</span>
              <span class="font-bold text-slate-800">${appointment.clientName}</span>
            </div>
            <div class="flex justify-between pt-2 border-t border-slate-200">
              <span class="text-slate-500 font-medium">Total a pagar en local:</span>
              <span class="font-black text-sm text-slate-900">${this.formatColones(appointment.servicePrice)}</span>
            </div>
          </div>

          <div class="mt-6 flex flex-col gap-2">
            <button id="success-done-btn" class="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all">
              Aceptar y Continuar
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('success-done-btn')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
      this.renderCurrentView();
    });
  }

  // ==========================================
  // VISTA 3: PANEL DE DUEÑO DE NEGOCIO (DASHBOARD)
  // ==========================================
  renderOwnerDashboardView(container) {
    const businesses = storage.getBusinesses();
    const activeBizId = storage.getActiveBusinessId();
    const currentBiz = storage.getBusinessById(activeBizId) || businesses[0];
    const appointments = storage.getAppointmentsByBusiness(currentBiz.id);

    // Métricas rápidas
    const todayStr = this.getTodayDateString();
    const todayAppointments = appointments.filter(a => a.date === todayStr && a.status !== 'cancelled');
    const estimatedRevenue = appointments.filter(a => a.status === 'confirmed' || a.status === 'completed').reduce((sum, a) => sum + (a.servicePrice || 0), 0);

    container.innerHTML = `
      <div class="animate-fade-in pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <!-- Top Bar: Switch Business or Create New -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs mb-8">
          <div class="flex items-center gap-4">
            <img src="${currentBiz.image || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80'}" alt="${currentBiz.name}" class="w-16 h-16 rounded-2xl object-cover border border-slate-200 shadow-sm">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-blue-600 uppercase tracking-wider">Panel de Administración</span>
                ${currentBiz.isDemo ? `
                  <span class="bg-purple-100 text-purple-700 text-[10px] font-extrabold px-2 py-0.5 rounded-md">Comercio de Muestra</span>
                ` : `
                  <span class="bg-emerald-100 text-emerald-700 text-[10px] font-extrabold px-2 py-0.5 rounded-md">Comercio Registrado</span>
                `}
              </div>
              <h1 class="text-xl font-extrabold text-slate-900">${currentBiz.name}</h1>
              <span class="text-xs text-slate-500">${currentBiz.city} • ${currentBiz.categoryLabel}</span>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <div class="flex flex-col text-right">
              <span class="text-[11px] font-bold text-slate-400 uppercase">Cambiar Negocio</span>
              <select id="switch-business-select" class="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500">
                ${businesses.map(b => `
                  <option value="${b.id}" ${b.id === currentBiz.id ? 'selected' : ''}>${b.name} ${b.isDemo ? '(Muestra)' : ''}</option>
                `).join('')}
              </select>
            </div>

            <button id="open-new-biz-modal-btn" class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20">
              <i class="fas fa-plus"></i> Registrar Negocio
            </button>
          </div>
        </div>

        <!-- Metric Stat Cards -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div class="flex items-center justify-between text-slate-500 mb-2">
              <span class="text-xs font-semibold uppercase">Citas Hoy</span>
              <i class="fas fa-calendar-day text-blue-600"></i>
            </div>
            <span class="text-2xl font-black text-slate-900">${todayAppointments.length}</span>
            <span class="text-[11px] text-slate-400 block mt-1">turnos agendados</span>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div class="flex items-center justify-between text-slate-500 mb-2">
              <span class="text-xs font-semibold uppercase">Total Reservas</span>
              <i class="fas fa-users text-indigo-600"></i>
            </div>
            <span class="text-2xl font-black text-slate-900">${appointments.length}</span>
            <span class="text-[11px] text-slate-400 block mt-1">histórico total</span>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div class="flex items-center justify-between text-slate-500 mb-2">
              <span class="text-xs font-semibold uppercase">Ingresos Est.</span>
              <span class="font-extrabold text-emerald-600 text-sm">CRC</span>
            </div>
            <span class="text-2xl font-black text-slate-900">${this.formatColones(estimatedRevenue)}</span>
            <span class="text-[11px] text-emerald-600 block mt-1">citas confirmadas</span>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div class="flex items-center justify-between text-slate-500 mb-2">
              <span class="text-xs font-semibold uppercase">Servicios</span>
              <i class="fas fa-list text-amber-600"></i>
            </div>
            <span class="text-2xl font-black text-slate-900">${currentBiz.services ? currentBiz.services.length : 0}</span>
            <span class="text-[11px] text-slate-400 block mt-1">activos en catálogo</span>
          </div>
        </div>

        <!-- Tabs Navigation -->
        <div class="flex items-center gap-2 border-b border-slate-200 mb-6 overflow-x-auto pb-2">
          <button class="dash-tab-btn px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${this.activeDashboardTab === 'appointments' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-100'}" data-tab="appointments">
            <i class="fas fa-calendar-alt mr-1.5"></i> Agenda (${appointments.length})
          </button>
          <button class="dash-tab-btn px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${this.activeDashboardTab === 'services' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-100'}" data-tab="services">
            <i class="fas fa-tag mr-1.5"></i> Servicios y Precios (${currentBiz.services ? currentBiz.services.length : 0})
          </button>
          <button class="dash-tab-btn px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${this.activeDashboardTab === 'profile' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-100'}" data-tab="profile">
            <i class="fas fa-image mr-1.5"></i> Perfil, Fotos & Banner
          </button>
          <button class="dash-tab-btn px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${this.activeDashboardTab === 'schedule' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-100'}" data-tab="schedule">
            <i class="fas fa-clock mr-1.5"></i> Horarios de Atención
          </button>
        </div>

        <!-- Dynamic Tab Content -->
        <div id="dashboard-tab-content">
          ${this.renderDashboardTabContent(currentBiz, appointments)}
        </div>
      </div>
    `;

    // Listeners del Dashboard
    document.getElementById('switch-business-select')?.addEventListener('change', (e) => {
      storage.setActiveBusinessId(e.target.value);
      this.renderCurrentView();
    });

    document.querySelectorAll('.dash-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeDashboardTab = btn.getAttribute('data-tab');
        this.renderCurrentView();
      });
    });

    document.getElementById('open-new-biz-modal-btn')?.addEventListener('click', () => {
      this.renderNewBusinessModal();
    });

    this.setupDashboardTabEvents(currentBiz);
  }

  // --- SUB-CONTENIDOS DEL DASHBOARD ---
  renderDashboardTabContent(currentBiz, appointments) {
    if (this.activeDashboardTab === 'appointments') {
      return `
        <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 class="text-lg font-bold text-slate-900">Agenda y Reservas</h2>
              <p class="text-xs text-slate-500">Gestiona las reservas de tus clientes y cambia sus estados en tiempo real.</p>
            </div>

            <button id="add-manual-appointment-btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all">
              <i class="fas fa-plus-circle"></i> Nueva Reserva Manual
            </button>
          </div>

          ${appointments.length === 0 ? `
            <div class="text-center py-12 text-slate-400">
              <i class="far fa-calendar-times text-4xl mb-2"></i>
              <p class="text-sm font-semibold">Aún no hay reservas registradas para este negocio.</p>
            </div>
          ` : `
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs text-slate-700">
                <thead class="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th class="py-3 px-4">Fecha / Hora</th>
                    <th class="py-3 px-4">Cliente</th>
                    <th class="py-3 px-4">Servicio</th>
                    <th class="py-3 px-4">Monto</th>
                    <th class="py-3 px-4">Estado</th>
                    <th class="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  ${appointments.map(apt => `
                    <tr class="hover:bg-slate-50/80 transition-colors">
                      <td class="py-3.5 px-4 font-bold text-slate-900">
                        <div>${apt.date}</div>
                        <div class="text-blue-600 text-[11px] font-mono">${apt.time} (${apt.serviceDuration}m)</div>
                      </td>
                      <td class="py-3.5 px-4">
                        <div class="font-bold text-slate-800">${apt.clientName}</div>
                        <div class="text-slate-400 text-[11px]">${apt.clientPhone}</div>
                      </td>
                      <td class="py-3.5 px-4 font-medium text-slate-700">
                        ${apt.serviceName}
                        ${apt.notes ? `<div class="text-[10px] text-slate-400 italic">"${apt.notes}"</div>` : ''}
                      </td>
                      <td class="py-3.5 px-4 font-extrabold text-slate-900">
                        ${this.formatColones(apt.servicePrice)}
                      </td>
                      <td class="py-3.5 px-4">
                        <span class="badge-status badge-status-${apt.status}">
                          ${apt.status === 'confirmed' ? 'Confirmada' : apt.status === 'pending' ? 'Pendiente' : apt.status === 'completed' ? 'Completada' : 'Cancelada'}
                        </span>
                      </td>
                      <td class="py-3.5 px-4 text-right space-x-1">
                        ${apt.status !== 'completed' ? `
                          <button class="status-change-btn p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg" data-apt-id="${apt.id}" data-status="completed" title="Marcar como completada">
                            <i class="fas fa-check"></i>
                          </button>
                        ` : ''}
                        ${apt.status !== 'cancelled' ? `
                          <button class="status-change-btn p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg" data-apt-id="${apt.id}" data-status="cancelled" title="Cancelar reserva">
                            <i class="fas fa-ban"></i>
                          </button>
                        ` : ''}
                        <button class="delete-apt-btn p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" data-apt-id="${apt.id}" title="Eliminar registro">
                          <i class="fas fa-trash-alt"></i>
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      `;
    }

    if (this.activeDashboardTab === 'services') {
      return `
        <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h2 class="text-lg font-bold text-slate-900">Catálogo de Servicios y Precios</h2>
              <p class="text-xs text-slate-500">Agrega, modifica precios en colones (₡) o duraciones de tus servicios.</p>
            </div>

            <button id="add-new-service-btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all">
              <i class="fas fa-plus"></i> Agregar Servicio
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${currentBiz.services && currentBiz.services.length > 0 ? currentBiz.services.map(srv => `
              <div class="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
                <div>
                  <div class="flex items-center justify-between">
                    <h3 class="font-bold text-base text-slate-900">${srv.name}</h3>
                    <span class="text-base font-black text-blue-600">${this.formatColones(srv.price)}</span>
                  </div>
                  <span class="inline-block mt-1 px-2.5 py-0.5 rounded-md bg-slate-200 text-slate-700 text-xs font-semibold">
                    <i class="far fa-clock mr-1"></i>${srv.duration} minutos
                  </span>
                  <p class="text-xs text-slate-500 mt-2">${srv.description || 'Sin descripción'}</p>
                </div>

                <div class="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-end gap-2">
                  <button class="edit-service-btn text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors" data-service-id="${srv.id}">
                    <i class="fas fa-edit mr-1"></i> Editar
                  </button>
                  <button class="delete-service-btn text-xs font-bold text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors" data-service-id="${srv.id}">
                    <i class="fas fa-trash-alt mr-1"></i> Eliminar
                  </button>
                </div>
              </div>
            `).join('') : `
              <p class="text-sm text-slate-400 py-4 col-span-2 text-center">No hay servicios registrados. Agrega el primero con el botón superior.</p>
            `}
          </div>
        </div>
      `;
    }

    if (this.activeDashboardTab === 'profile') {
      const allFeatures = [
        'Sinpe Móvil', 'Acepta Tarjeta', 'Parqueo Gratis', 'Parqueo Bajo Techo',
        'Aire Acondicionado', 'WiFi Gratis', 'Pet Friendly', 'Acceso Silla de Ruedas',
        'Café de Cortesía', 'Sala de Espera', 'Atención Personalizada', 'Garantía por Escrito'
      ];
      const currentFeatures = currentBiz.features || [];

      return `
        <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs max-w-3xl">
          <h2 class="text-lg font-bold text-slate-900 mb-1">Editar Perfil, Fotos & Banner</h2>
          <p class="text-xs text-slate-500 mb-6">Personaliza la imagen y los datos de contacto que ven tus clientes en el directorio.</p>

          <form id="edit-profile-form" class="space-y-6 text-xs sm:text-sm">
            <!-- Sección Fotos con Guía de Medidas -->
            <div class="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-5">
              <h3 class="font-bold text-slate-800 text-sm flex items-center gap-2">
                <i class="fas fa-images text-blue-600"></i> Fotos y Banners del Comercio
              </h3>

              <!-- Banner de Portada -->
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <label class="font-bold text-slate-700">Banner / Portada Principal</label>
                  <span class="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200">
                    <i class="fas fa-ruler-combined mr-1"></i> Medida recomendada: 1200 x 450 px (Panorámica 16:6)
                  </span>
                </div>
                <input type="text" id="edit-biz-cover" value="${currentBiz.coverImage || ''}" placeholder="URL de la imagen de portada (https://...)" class="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl">
                <!-- Preview Banner -->
                <div class="h-32 w-full rounded-xl overflow-hidden bg-slate-200 border border-slate-300 relative">
                  <img id="preview-cover-img" src="${currentBiz.coverImage || currentBiz.image}" alt="Vista previa banner" class="w-full h-full object-cover">
                  <span class="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded">Vista previa del banner</span>
                </div>
              </div>

              <!-- Foto de Perfil / Logo -->
              <div class="space-y-2 pt-3 border-t border-slate-200">
                <div class="flex items-center justify-between">
                  <label class="font-bold text-slate-700">Foto de Perfil / Logo Cuadrado</label>
                  <span class="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200">
                    <i class="fas fa-ruler-combined mr-1"></i> Medida recomendada: 800 x 800 px (Cuadrada 1:1)
                  </span>
                </div>
                <input type="text" id="edit-biz-image" value="${currentBiz.image || ''}" placeholder="URL del logo o foto de perfil (https://...)" class="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl">
                <!-- Preview Logo -->
                <div class="flex items-center gap-3">
                  <img id="preview-logo-img" src="${currentBiz.image}" alt="Vista previa logo" class="w-16 h-16 rounded-2xl object-cover border border-slate-300">
                  <span class="text-xs text-slate-500">Se muestra en las tarjetas de búsqueda del directorio.</span>
                </div>
              </div>
            </div>

            <!-- Datos Generales -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Nombre del Negocio *</label>
                <input type="text" id="edit-biz-name" value="${currentBiz.name}" required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Ciudad / Cantón *</label>
                <input type="text" id="edit-biz-city" value="${currentBiz.city}" required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Teléfono / WhatsApp *</label>
                <input type="tel" id="edit-biz-phone" value="${currentBiz.phone}" required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Correo Electrónico</label>
                <input type="email" id="edit-biz-email" value="${currentBiz.email || ''}" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Dirección Exacta</label>
              <input type="text" id="edit-biz-address" value="${currentBiz.address || ''}" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Descripción del Negocio</label>
              <textarea id="edit-biz-desc" rows="3" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">${currentBiz.description || ''}</textarea>
            </div>

            <!-- Características / Comodidades -->
            <div>
              <label class="block font-bold text-slate-700 mb-2 uppercase text-xs tracking-wider">Comodidades y Métodos de Pago</label>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                ${allFeatures.map(feat => `
                  <label class="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs">
                    <input type="checkbox" name="biz_features" value="${feat}" ${currentFeatures.includes(feat) ? 'checked' : ''} class="rounded text-blue-600">
                    <span class="font-medium text-slate-700">${feat}</span>
                  </label>
                `).join('')}
              </div>
            </div>

            <button type="submit" class="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/25 transition-all text-sm">
              <i class="fas fa-save mr-1.5"></i> Guardar Cambios de Perfil
            </button>
          </form>
        </div>
      `;
    }

    if (this.activeDashboardTab === 'schedule') {
      const sch = currentBiz.schedule || { days: [1,2,3,4,5,6], openTime: '08:00', closeTime: '18:00' };
      const days = [
        { id: 1, name: 'Lunes' },
        { id: 2, name: 'Martes' },
        { id: 3, name: 'Miércoles' },
        { id: 4, name: 'Jueves' },
        { id: 5, name: 'Viernes' },
        { id: 6, name: 'Sábado' },
        { id: 0, name: 'Domingo' }
      ];

      return `
        <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs max-w-2xl">
          <h2 class="text-lg font-bold text-slate-900 mb-1">Configuración de Horarios y Disponibilidad</h2>
          <p class="text-xs text-slate-500 mb-6">Define los días y franjas horarias en las que tu negocio puede recibir citas.</p>

          <form id="schedule-form" class="space-y-6 text-xs sm:text-sm">
            <!-- Días laborales -->
            <div>
              <label class="block font-bold text-slate-700 mb-2 uppercase text-xs tracking-wider">Días de Atención</label>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                ${days.map(d => `
                  <label class="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" name="work_days" value="${d.id}" ${sch.days && sch.days.includes(d.id) ? 'checked' : ''} class="rounded text-blue-600 focus:ring-blue-500">
                    <span class="font-medium text-slate-800">${d.name}</span>
                  </label>
                `).join('')}
              </div>
            </div>

            <!-- Horarios de Apertura y Cierre -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Hora de Apertura</label>
                <input type="time" id="open-time" value="${sch.openTime || '08:00'}" required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Hora de Cierre</label>
                <input type="time" id="close-time" value="${sch.closeTime || '18:00'}" required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              </div>
            </div>

            <!-- Horario de Receso / Descanso -->
            <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <span class="font-bold text-slate-800 block">Receso / Almuerzo (Bloquea turnos automáticamente)</span>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-slate-500 text-xs mb-1">Inicio de descanso</label>
                  <input type="time" id="break-start" value="${sch.breakStart || ''}" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl">
                </div>
                <div>
                  <label class="block text-slate-500 text-xs mb-1">Fin de descanso</label>
                  <input type="time" id="break-end" value="${sch.breakEnd || ''}" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl">
                </div>
              </div>
            </div>

            <button type="submit" class="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/25 transition-all">
              Guardar Configuración de Horario
            </button>
          </form>
        </div>
      `;
    }
  }

  // --- LISTENERS ESPECÍFICOS DEL DASHBOARD ---
  setupDashboardTabEvents(currentBiz) {
    // Cambiar estado de citas
    document.querySelectorAll('.status-change-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const aptId = btn.getAttribute('data-apt-id');
        const newStatus = btn.getAttribute('data-status');
        await storage.updateAppointmentStatus(aptId, newStatus);
        this.showToast(`Estado de cita actualizado a: ${newStatus}`, 'info');
        this.renderCurrentView();
      });
    });

    // Eliminar cita
    document.querySelectorAll('.delete-apt-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const aptId = btn.getAttribute('data-apt-id');
        if (confirm('¿Deseas eliminar este registro de reserva?')) {
          await storage.deleteAppointment(aptId);
          this.showToast('Reserva eliminada.', 'info');
          this.renderCurrentView();
        }
      });
    });

    // Abrir modal de nueva cita manual
    document.getElementById('add-manual-appointment-btn')?.addEventListener('click', () => {
      this.openBookingModal(currentBiz.id, currentBiz.services && currentBiz.services[0]?.id);
    });

    // Abrir modal de agregar servicio
    document.getElementById('add-new-service-btn')?.addEventListener('click', () => {
      this.renderNewServiceModal(currentBiz.id);
    });

    // Editar servicio existente
    document.querySelectorAll('.edit-service-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sId = btn.getAttribute('data-service-id');
        const service = currentBiz.services?.find(s => s.id === sId);
        if (service) {
          this.renderEditServiceModal(currentBiz.id, service);
        }
      });
    });

    // Eliminar servicio
    document.querySelectorAll('.delete-service-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const sId = btn.getAttribute('data-service-id');
        if (confirm('¿Eliminar este servicio del catálogo?')) {
          await storage.deleteService(currentBiz.id, sId);
          this.showToast('Servicio eliminado.', 'info');
          this.renderCurrentView();
        }
      });
    });

    // Previsualización de imágenes en edición de perfil
    const coverInput = document.getElementById('edit-biz-cover');
    const imageInput = document.getElementById('edit-biz-image');
    coverInput?.addEventListener('input', (e) => {
      const img = document.getElementById('preview-cover-img');
      if (img && e.target.value) img.src = e.target.value;
    });
    imageInput?.addEventListener('input', (e) => {
      const img = document.getElementById('preview-logo-img');
      if (img && e.target.value) img.src = e.target.value;
    });

    // Guardar cambios en el perfil del negocio
    const profileForm = document.getElementById('edit-profile-form');
    profileForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('edit-biz-name').value;
      const city = document.getElementById('edit-biz-city').value;
      const phone = document.getElementById('edit-biz-phone').value;
      const email = document.getElementById('edit-biz-email').value;
      const address = document.getElementById('edit-biz-address').value;
      const description = document.getElementById('edit-biz-desc').value;
      const image = document.getElementById('edit-biz-image').value;
      const coverImage = document.getElementById('edit-biz-cover').value;
      const features = Array.from(document.querySelectorAll('input[name="biz_features"]:checked')).map(cb => cb.value);

      await storage.saveBusiness({
        ...currentBiz,
        name,
        city,
        phone,
        email,
        address,
        description,
        image,
        coverImage,
        features
      });

      this.showToast('¡Perfil del negocio actualizado con éxito!', 'success');
      this.renderCurrentView();
    });

    // Guardar horarios
    const scheduleForm = document.getElementById('schedule-form');
    scheduleForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const selectedDays = Array.from(document.querySelectorAll('input[name="work_days"]:checked')).map(cb => parseInt(cb.value, 10));
      const openTime = document.getElementById('open-time').value;
      const closeTime = document.getElementById('close-time').value;
      const breakStart = document.getElementById('break-start').value;
      const breakEnd = document.getElementById('break-end').value;

      currentBiz.schedule = {
        days: selectedDays,
        openTime,
        closeTime,
        breakStart: breakStart || null,
        breakEnd: breakEnd || null,
        slotDuration: currentBiz.schedule?.slotDuration || 30
      };

      await storage.saveBusiness(currentBiz);
      this.showToast('Horarios actualizados exitosamente.', 'success');
      this.renderCurrentView();
    });
  }

  // --- MODAL PARA AGREGAR SERVICIO ---
  renderNewServiceModal(businessId) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop animate-fade-in">
        <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-slate-900">Agregar Nuevo Servicio</h3>
            <button id="close-srv-modal-btn" class="text-slate-400 hover:text-slate-600">
              <i class="fas fa-times text-lg"></i>
            </button>
          </div>

          <form id="new-service-form" class="space-y-4 text-xs sm:text-sm">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Nombre del Servicio *</label>
              <input type="text" id="srv-name" required placeholder="Ej. Limpieza Facial Profunda" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Precio (₡ CRC) *</label>
                <input type="number" id="srv-price" required min="0" step="500" placeholder="Ej. 15000" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Duración (min) *</label>
                <select id="srv-duration" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium">
                  <option value="15">15 min</option>
                  <option value="30" selected>30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">60 min (1 hr)</option>
                  <option value="90">90 min (1.5 hrs)</option>
                  <option value="120">120 min (2 hrs)</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Descripción</label>
              <textarea id="srv-desc" rows="2" placeholder="Detalles de lo que incluye el servicio..." class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl"></textarea>
            </div>

            <button type="submit" class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/20 transition-all">
              Crear Servicio
            </button>
          </form>
        </div>
      </div>
    `;

    document.getElementById('close-srv-modal-btn')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
    });

    document.getElementById('new-service-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('srv-name').value;
      const price = document.getElementById('srv-price').value;
      const duration = document.getElementById('srv-duration').value;
      const description = document.getElementById('srv-desc').value;

      await storage.addService(businessId, { name, price, duration, description });
      this.showToast('Servicio agregado al catálogo.', 'success');
      modalContainer.innerHTML = '';
      this.renderCurrentView();
    });
  }

  // --- MODAL PARA EDITAR SERVICIO ---
  renderEditServiceModal(businessId, service) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop animate-fade-in">
        <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-slate-900">Editar Servicio</h3>
            <button id="close-edit-srv-btn" class="text-slate-400 hover:text-slate-600">
              <i class="fas fa-times text-lg"></i>
            </button>
          </div>

          <form id="edit-service-form" class="space-y-4 text-xs sm:text-sm">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Nombre del Servicio *</label>
              <input type="text" id="edit-srv-name" value="${service.name}" required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Precio (₡ CRC) *</label>
                <input type="number" id="edit-srv-price" value="${service.price}" required min="0" step="500" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Duración (min) *</label>
                <select id="edit-srv-duration" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium">
                  <option value="15" ${service.duration === 15 ? 'selected' : ''}>15 min</option>
                  <option value="30" ${service.duration === 30 ? 'selected' : ''}>30 min</option>
                  <option value="45" ${service.duration === 45 ? 'selected' : ''}>45 min</option>
                  <option value="60" ${service.duration === 60 ? 'selected' : ''}>60 min (1 hr)</option>
                  <option value="90" ${service.duration === 90 ? 'selected' : ''}>90 min (1.5 hrs)</option>
                  <option value="120" ${service.duration === 120 ? 'selected' : ''}>120 min (2 hrs)</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Descripción</label>
              <textarea id="edit-srv-desc" rows="2" class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl">${service.description || ''}</textarea>
            </div>

            <button type="submit" class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/20 transition-all">
              Guardar Cambios
            </button>
          </form>
        </div>
      </div>
    `;

    document.getElementById('close-edit-srv-btn')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
    });

    document.getElementById('edit-service-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('edit-srv-name').value;
      const price = document.getElementById('edit-srv-price').value;
      const duration = document.getElementById('edit-srv-duration').value;
      const description = document.getElementById('edit-srv-desc').value;

      await storage.updateService(businessId, service.id, { name, price, duration, description });
      this.showToast('Servicio actualizado con éxito.', 'success');
      modalContainer.innerHTML = '';
      this.renderCurrentView();
    });
  }

  // --- MODAL PARA REGISTRAR NUEVO NEGOCIO (ONBOARDING) ---
  renderNewBusinessModal() {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop animate-fade-in overflow-y-auto">
        <div class="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 p-6 sm:p-8 my-8 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div>
              <span class="text-xs font-bold text-emerald-600 uppercase">Onboarding de Comercios 🇨🇷</span>
              <h3 class="text-xl font-extrabold text-slate-900">Registrar Nuevo Establecimiento</h3>
            </div>
            <button id="close-biz-modal-btn" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <form id="new-biz-form" class="space-y-4 text-xs sm:text-sm">
            <!-- Datos Básicos -->
            <div>
              <label class="block font-bold text-slate-700 mb-1">Nombre Comercial del Negocio *</label>
              <input type="text" id="new-biz-name" required placeholder="Ej. Barbería Costa Rica, Clínica Dental Alajuela..." class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none">
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Categoría *</label>
                <select id="new-biz-cat" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  <option value="belleza">Belleza y Barbería</option>
                  <option value="salud">Salud y Bienestar</option>
                  <option value="spa">Spa y Masajes</option>
                  <option value="fitness">Fitness y Deporte</option>
                  <option value="autos">Talleres y Autos</option>
                  <option value="fotografia">Fotografía y Eventos</option>
                </select>
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1">Provincia / Cantón *</label>
                <input type="text" id="new-biz-city" required placeholder="Ej. San José, Escazú / Heredia..." class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none">
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Teléfono / WhatsApp (+506) *</label>
                <input type="tel" id="new-biz-phone" required placeholder="+506 8888 7777" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Correo Electrónico</label>
                <input type="email" id="new-biz-email" placeholder="contacto@negocio.cr" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none">
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Dirección Exacta</label>
              <input type="text" id="new-biz-address" placeholder="Ej. 150m Oeste del Parque Central, Local #4" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none">
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Descripción de Servicios</label>
              <textarea id="new-biz-desc" rows="2" placeholder="Describe brevemente tus especialidades y experiencia..." class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"></textarea>
            </div>

            <!-- Sección de Fotos y Banner con Indicaciones de Medidas -->
            <div class="p-4 bg-blue-50/70 border border-blue-100 rounded-2xl space-y-3">
              <span class="font-bold text-blue-900 block text-xs uppercase tracking-wider">
                <i class="fas fa-camera mr-1"></i> Fotos del Comercio (Guía de Medidas)
              </span>

              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-xs font-bold text-slate-700">Foto de Perfil / Logo (Cuadrada)</label>
                  <span class="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">Medida: 800 x 800 px (1:1)</span>
                </div>
                <input type="text" id="new-biz-image" placeholder="URL de la imagen (deja en blanco para imagen por defecto)" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs">
              </div>

              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-xs font-bold text-slate-700">Banner / Foto de Portada (Panorámica)</label>
                  <span class="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">Medida: 1200 x 450 px (16:6)</span>
                </div>
                <input type="text" id="new-biz-cover" placeholder="URL del banner (deja en blanco para banner por defecto)" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs">
              </div>
            </div>

            <!-- Primer Servicio Obligatorio -->
            <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
              <span class="font-bold text-slate-800 block text-xs uppercase tracking-wider">
                <i class="fas fa-tag mr-1 text-emerald-600"></i> Agrega tu Primer Servicio
              </span>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div class="sm:col-span-2">
                  <input type="text" id="first-srv-name" required placeholder="Nombre del servicio (Ej. Consulta General)" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs">
                </div>
                <div>
                  <input type="number" id="first-srv-price" required min="0" step="500" placeholder="Precio ₡ CRC" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold">
                </div>
              </div>
            </div>

            <button type="submit" class="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold shadow-lg shadow-emerald-500/25 transition-all text-sm flex items-center justify-center gap-2">
              <i class="fas fa-check-circle"></i>
              <span>Completar Registro y Empezar a Recibir Citas</span>
            </button>
          </form>
        </div>
      </div>
    `;

    document.getElementById('close-biz-modal-btn')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
    });

    document.getElementById('new-biz-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('new-biz-name').value;
      const category = document.getElementById('new-biz-cat').value;
      const city = document.getElementById('new-biz-city').value;
      const phone = document.getElementById('new-biz-phone').value;
      const email = document.getElementById('new-biz-email').value;
      const address = document.getElementById('new-biz-address').value;
      const description = document.getElementById('new-biz-desc').value;
      const image = document.getElementById('new-biz-image').value;
      const coverImage = document.getElementById('new-biz-cover').value;
      const firstSrvName = document.getElementById('first-srv-name').value;
      const firstSrvPrice = document.getElementById('first-srv-price').value;

      const catLabels = {
        belleza: 'Belleza y Barbería',
        salud: 'Salud y Bienestar',
        spa: 'Spa y Masajes',
        fitness: 'Fitness y Deporte',
        autos: 'Talleres y Autos',
        fotografia: 'Fotografía y Eventos'
      };

      const newId = `biz-${Date.now()}`;
      await storage.saveBusiness({
        id: newId,
        name,
        category,
        categoryLabel: catLabels[category] || 'Servicios',
        city,
        phone,
        email,
        address,
        description,
        image: image || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80',
        coverImage: coverImage || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80',
        isDemo: false,
        features: ['Sinpe Móvil', 'Atención Personalizada'],
        services: [
          { id: `srv-${Date.now()}-1`, name: firstSrvName, duration: 30, price: parseFloat(firstSrvPrice) || 10000, description: 'Servicio principal del establecimiento.' }
        ]
      });

      storage.setActiveBusinessId(newId);
      this.showToast('¡Comercio registrado exitosamente!', 'success');
      modalContainer.innerHTML = '';
      this.navigateTo('owner-dashboard');
    });
  }

  // --- EVENTOS GLOBALES ---
  setupGlobalEvents() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeBookingModal();
        const modalContainer = document.getElementById('modal-container');
        if (modalContainer) modalContainer.innerHTML = '';
      }
    });
  }
}

// Inicializar la aplicación cuando cargue el DOM
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
