// Controlador principal de la aplicación (Reservas CR - Directorio & Reservas)
import storage from './services/storage.js';

// FLAGS DE LA PLATAFORMA: Registro, login y suscripciones activas
const REGISTRATION_ENABLED = true;
const SHOW_BIZ_SHORTCUTS = false;
const SHOW_LOGIN_BUTTON = true;
const SHOW_PREREGISTER_BANNER = false;

class App {
  constructor() {
    this.currentView = 'directory'; // 'directory' | 'business-detail' | 'owner-dashboard' | 'my-client-bookings' | 'developer-dashboard'
    this.selectedBusinessId = null;
    this.selectedCategory = 'all';
    this.searchQuery = '';
    
    // Filtros de citas
    this.ownerAppointmentFilter = 'all'; // 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled'
    this.ownerStaffFilter = 'all'; // 'all' | 'unassigned' | staffId
    this.clientAppointmentFilter = 'all'; // 'all' | 'active' | 'completed' | 'cancelled'

    // Estado del modal de reserva
    this.bookingState = {
      isOpen: false,
      businessId: null,
      serviceId: null,
      staffId: 'any',
      selectedDate: this.getTodayDateString(),
      selectedTime: null
    };

    // Estado del panel de dueño
    this.activeDashboardTab = 'appointments'; // 'appointments' | 'blocked-slots' | 'services' | 'team' | 'profile' | 'schedule'

    // Estado del panel de developer
    this.activeDevTab = 'alerts'; // 'alerts' | 'businesses' | 'clients' | 'appointments'
    this.devSearchQuery = '';
    this.devBizFilter = 'all'; // 'all' | 'active' | 'hidden' | 'blocked' | 'real' | 'demo'
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

  formatTime12h(timeStr) {
    if (!timeStr) return '';
    const clean = String(timeStr).trim();
    if (clean.includes('AM') || clean.includes('PM') || clean.includes('am') || clean.includes('pm')) {
      return clean;
    }
    const parts = clean.split(':');
    if (parts.length < 2) return clean;
    let hour = parseInt(parts[0], 10);
    const minute = parts[1].padStart(2, '0');
    if (isNaN(hour)) return clean;
    const period = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return `${hour}:${minute} ${period}`;
  }

  formatDateDMY(dateStr) {
    if (!dateStr) return '';
    const clean = String(dateStr).trim();
    if (clean.includes('/')) return clean;
    const parts = clean.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }
    return clean;
  }

  formatDateFullSpanish(dateStr) {
    if (!dateStr) return '';
    const clean = String(dateStr).trim();
    const parts = clean.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts.map(Number);
      const date = new Date(y, m - 1, d);
      const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      return `${days[date.getDay()]}, ${d} de ${months[m - 1]} de ${y}`;
    }
    return clean;
  }

  normalizeText(str) {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  init() {
    // 1. Escuchar botones Atrás y Adelante del navegador
    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.view) {
        this.navigateTo(e.state.view, e.state.params || {}, false);
      } else {
        const route = this.parseHash(window.location.hash);
        this.navigateTo(route.view, route.params || {}, false);
      }
    });

    // 2. Escuchar cambios directos en el Hash
    window.addEventListener('hashchange', () => {
      const route = this.parseHash(window.location.hash);
      this.navigateTo(route.view, route.params || {}, false);
    });

    // 3. Obtener ruta inicial según la URL actual
    const initialRoute = this.parseHash(window.location.hash);
    this.currentView = initialRoute.view;
    this.currentRouteParams = initialRoute.params || {};
    if (initialRoute.params.businessId) {
      this.selectedBusinessId = initialRoute.params.businessId;
    }
    if (initialRoute.params.appointmentId) {
      this.selectedAppointmentId = initialRoute.params.appointmentId;
    }

    const initialHash = this.getHashForView(this.currentView, initialRoute.params);
    if (window.history && window.history.replaceState) {
      window.history.replaceState({ view: this.currentView, params: initialRoute.params }, '', initialHash);
    }

    this.renderHeader();
    this.renderMobileBottomNav();
    this.renderCurrentView();
    this.setupGlobalEvents();
  }

  // --- RUTAS Y HASH DE NAVEGACIÓN ---
  getHashForView(view, params = {}) {
    switch (view) {
      case 'business-detail': {
        const bizId = params.businessId || this.selectedBusinessId;
        return bizId ? `#/negocio/${encodeURIComponent(bizId)}` : '#/';
      }
      case 'review-booking': {
        const aptId = params.appointmentId || this.selectedAppointmentId;
        const query = params.rating ? `?rating=${params.rating}` : '';
        return aptId ? `#/calificar/${encodeURIComponent(aptId)}${query}` : '#/';
      }
      case 'my-client-bookings':
        return '#/mis-reservas';
      case 'owner-dashboard':
        return '#/panel-negocio';
      case 'developer-dashboard':
        return '#/developer';
      case 'directory':
      default:
        return '#/';
    }
  }

  parseHash(hash = window.location.hash) {
    const cleanHash = (hash || '').trim();
    const searchParams = new URLSearchParams(window.location.search);

    // 1. Revisar si viene en query params (?calificar=apt-xxx o ?aptId=apt-xxx)
    if (searchParams.has('calificar') || searchParams.has('aptId') || searchParams.has('appointmentId')) {
      const aptId = searchParams.get('calificar') || searchParams.get('aptId') || searchParams.get('appointmentId');
      const rating = searchParams.get('rating');
      return {
        view: 'review-booking',
        params: {
          appointmentId: decodeURIComponent(aptId),
          rating: rating ? parseInt(rating, 10) : null
        }
      };
    }

    // 2. Ruta raíz vacía
    if (!cleanHash || cleanHash === '#' || cleanHash === '#/' || cleanHash === '#!/') {
      return { view: 'directory', params: {} };
    }

    // 3. Revisar hash #/calificar/apt-xxx?rating=5 o #calificar/apt-xxx
    const reviewMatch = cleanHash.match(/^#\/?(calificar|review|valorar)\/([^/?#]+)/i);
    if (reviewMatch) {
      let ratingParam = null;
      if (cleanHash.includes('?')) {
        const hashQuery = cleanHash.split('?')[1];
        const params = new URLSearchParams(hashQuery);
        ratingParam = params.get('rating');
      } else if (searchParams.has('rating')) {
        ratingParam = searchParams.get('rating');
      }
      return {
        view: 'review-booking',
        params: {
          appointmentId: decodeURIComponent(reviewMatch[2]),
          rating: ratingParam ? parseInt(ratingParam, 10) : null
        }
      };
    }

    // 4. Revisar hash #/calificar?id=apt-xxx&rating=5
    if (/^#\/?(calificar|review|valorar)(\?|$)/i.test(cleanHash)) {
      const hashQuery = cleanHash.includes('?') ? cleanHash.split('?')[1] : '';
      const params = new URLSearchParams(hashQuery);
      const aptId = params.get('id') || params.get('appointmentId') || params.get('aptId') || searchParams.get('id') || searchParams.get('appointmentId');
      const ratingParam = params.get('rating') || searchParams.get('rating');
      if (aptId) {
        return {
          view: 'review-booking',
          params: {
            appointmentId: decodeURIComponent(aptId),
            rating: ratingParam ? parseInt(ratingParam, 10) : null
          }
        };
      }
    }

    // 5. Negocio
    const bizMatch = cleanHash.match(/^#\/?negocio\/([^/?#]+)/i);
    if (bizMatch) {
      return { view: 'business-detail', params: { businessId: decodeURIComponent(bizMatch[1]) } };
    }

    // 6. Mis citas
    if (/^#\/?(mis-reservas|mis-reservas|cliente)/i.test(cleanHash)) {
      return { view: 'my-client-bookings', params: {} };
    }

    // 7. Panel negocio
    if (/^#\/?(panel-negocio|dashboard|owner)/i.test(cleanHash)) {
      return { view: 'owner-dashboard', params: {} };
    }

    // 8. Developer
    if (/^#\/?(developer|developer-dashboard|admin)/i.test(cleanHash)) {
      return { view: 'developer-dashboard', params: {} };
    }

    // 9. Acceso directo por URL (login/acceso)
    if (/^#\/?(login|acceso|entrar|soy-negocio)/i.test(cleanHash)) {
      setTimeout(() => this.renderAuthModal({ mode: 'login', role: 'business' }), 100);
      return { view: 'directory', params: {} };
    }

    return { view: 'directory', params: {} };
  }

  // --- NAVEGACIÓN ---
  navigateTo(view, params = {}, pushHistory = true) {
    this.currentView = view;
    this.currentRouteParams = params || {};
    if (params.businessId) {
      this.selectedBusinessId = params.businessId;
    }
    if (params.appointmentId) {
      this.selectedAppointmentId = params.appointmentId;
    }

    const targetHash = this.getHashForView(view, params);

    if (pushHistory && window.history) {
      if (window.location.hash !== targetHash && window.history.pushState) {
        window.history.pushState({ view, params }, '', targetHash);
      } else if (window.history.replaceState) {
        window.history.replaceState({ view, params }, '', targetHash);
      }
    }

    this.renderHeader();
    this.renderMobileBottomNav();
    this.renderCurrentView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.navigateTo('directory');
    }
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

  // --- HEADER / NAVBAR (ACCESO USUARIOS Y NEGOCIOS) ---
  renderHeader() {
    const headerContainer = document.getElementById('navbar-container');
    if (!headerContainer) return;

    const devUser = storage.getDeveloperUser();
    const bizUser = storage.getBusinessUser();
    const clientUser = storage.getClientUser();
    const activeBiz = bizUser ? storage.getBusinessById(bizUser.businessId) : null;

    headerContainer.innerHTML = `
      <header class="sticky top-0 z-40 glass-header border-b border-slate-200/80 shadow-xs">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2">
          <!-- Logo -->
          <div class="flex items-center gap-2.5 sm:gap-3 cursor-pointer select-none group app-touch-btn" id="nav-logo-btn" title="Reservas CR">
            <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl overflow-hidden shadow-xs border border-slate-200/90 bg-white flex items-center justify-center group-hover:scale-105 transition-transform duration-300 flex-shrink-0">
              <img src="./src/assets/reservas_cr_clean_badge_1.jpg" alt="Reservas CR Logo" class="w-full h-full object-cover">
            </div>
            <div>
              <span class="font-black text-lg sm:text-xl tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent">Reservas <span class="text-blue-600">CR</span></span>
              <span class="text-[11px] sm:text-xs block text-slate-500 font-medium hidden sm:block">Directorio & Reservas de Servicios en Costa Rica 🇨🇷</span>
            </div>
          </div>

          <!-- MÓVIL (< md): Controles Compactos Superiores -->
          <div class="flex md:hidden items-center gap-1.5">
            ${devUser ? `
              <button id="mobile-top-dev-badge" class="px-2.5 py-1 rounded-lg bg-slate-900 text-amber-400 text-[11px] font-black border border-slate-700 flex items-center gap-1 app-touch-btn" title="Panel Developer">
                <i class="fas fa-shield-alt text-[10px]"></i>
                <span>DEV</span>
              </button>
            ` : ''}

            ${clientUser && !devUser ? `
              <button id="mobile-top-profile-badge" class="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200/60 flex items-center gap-1.5 app-touch-btn">
                <i class="fas fa-user-circle text-xs text-blue-600"></i>
                <span class="max-w-[80px] truncate">${clientUser.name ? clientUser.name.split(' ')[0] : 'Perfil'}</span>
              </button>
            ` : ''}

            ${bizUser && !devUser ? `
              <button id="mobile-top-biz-badge" class="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-200/60 flex items-center gap-1.5 app-touch-btn">
                <i class="fas fa-store text-xs text-indigo-600"></i>
                <span class="max-w-[80px] truncate">${activeBiz ? activeBiz.name : 'Negocio'}</span>
              </button>
            ` : ''}

            <!-- Botón Planes y Suscripciones (Móvil) -->
            <button id="mobile-top-plans-btn" class="px-2.5 py-1.5 rounded-xl text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 flex items-center gap-1 app-touch-btn" title="Ver Planes de Suscripción">
              <i class="fas fa-crown text-amber-600 text-xs"></i>
              <span>Planes</span>
            </button>

            ${!clientUser && !bizUser && !devUser && SHOW_LOGIN_BUTTON ? `
              <button id="mobile-top-login-btn" class="px-3 py-1.5 rounded-xl text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 flex items-center gap-1 app-touch-btn">
                <i class="fas fa-sign-in-alt text-xs"></i>
                <span>Entrar</span>
              </button>
            ` : ''}
          </div>

          <!-- ESCRITORIO PC (>= md): Navigation & Auth Controls Completos -->
          <div class="hidden md:flex items-center gap-2 sm:gap-3">
            <!-- Explorar -->
            <button id="nav-directory-btn" class="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${this.currentView === 'directory' || this.currentView === 'business-detail' ? 'bg-blue-50 text-blue-700 shadow-xs' : 'text-slate-600 hover:bg-slate-100'}">
              <i class="fas fa-compass mr-1"></i> Explorar
            </button>

            <!-- Planes y Precios -->
            <button id="nav-plans-btn" class="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer" title="Ver Planes de Suscripción">
              <i class="fas fa-crown text-amber-600 text-xs"></i>
              <span>Planes & Precios</span>
            </button>

            <!-- 0. SI EL DEVELOPER ESTÁ LOGUEADO -->
            ${devUser ? `
              <div class="flex items-center gap-1 bg-slate-900 text-white p-1 rounded-xl border border-slate-700 shadow-md animate-fade-in">
                <button id="nav-dev-dashboard-btn" class="px-3 py-1.5 rounded-lg text-xs font-black tracking-wide flex items-center gap-1.5 transition-all ${this.currentView === 'developer-dashboard' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-amber-400 hover:bg-slate-800'}">
                  <i class="fas fa-shield-alt text-xs"></i>
                  <span>DEVELOPER</span>
                </button>
                <button id="nav-dev-logout-btn" class="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg transition-colors" title="Cerrar sesión de Developer">
                  <i class="fas fa-sign-out-alt text-xs"></i>
                </button>
              </div>
            ` : ''}

            <!-- 1. SI EL CLIENTE ESTÁ LOGUEADO -->
            ${clientUser && !devUser ? `
              <div class="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button id="nav-client-bookings-btn" class="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-800 hover:bg-white transition-all flex items-center gap-1.5 ${this.currentView === 'my-client-bookings' ? 'bg-white shadow-xs text-blue-600' : ''}">
                  <i class="fas fa-user-circle text-blue-600 text-sm"></i>
                  <span class="max-w-[100px] truncate">${clientUser.name ? clientUser.name.split(' ')[0] : 'Mi Perfil'}</span>
                  <span class="hidden md:inline text-[10px] text-slate-400">(Mis Reservas)</span>
                </button>
                <button id="nav-client-logout-btn" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg" title="Cerrar sesión de cliente">
                  <i class="fas fa-sign-out-alt text-xs"></i>
                </button>
              </div>
            ` : ''}

            <!-- 2. SI EL NEGOCIO ESTÁ LOGUEADO -->
            ${bizUser && !devUser ? `
              <div class="flex items-center gap-1 bg-indigo-50 border border-indigo-100 p-1 rounded-xl">
                <button id="nav-biz-dashboard-btn" class="px-3.5 py-1.5 rounded-lg text-xs font-bold text-indigo-900 hover:bg-white transition-all flex items-center gap-1.5 ${this.currentView === 'owner-dashboard' ? 'bg-indigo-600 text-white shadow-xs' : ''}">
                  <i class="fas fa-store text-xs ${this.currentView === 'owner-dashboard' ? 'text-white' : 'text-indigo-600'}"></i>
                  <span class="max-w-[120px] truncate">${activeBiz ? activeBiz.name : 'Mi Negocio'}</span>
                </button>
                <button id="nav-biz-logout-btn" class="p-1.5 text-indigo-400 hover:text-rose-600 rounded-lg" title="Cerrar sesión de negocio">
                  <i class="fas fa-sign-out-alt text-xs"></i>
                </button>
              </div>
            ` : ''}

            <!-- 3. BOTONES INICIAR SESIÓN Y REGISTRARSE (CUANDO NO HAY SESIÓN ACTIVA) -->
            ${!clientUser && !bizUser && !devUser ? `
              ${SHOW_LOGIN_BUTTON ? `
              <button id="nav-login-btn" class="px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 shadow-xs flex items-center gap-1.5 transition-all">
                <i class="fas fa-sign-in-alt text-blue-600"></i>
                <span>Iniciar Sesión</span>
              </button>
              ` : ''}

              ${REGISTRATION_ENABLED ? `
              <button id="nav-register-btn" class="px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all">
                <i class="fas fa-user-plus"></i>
                <span>Registrarse</span>
              </button>
              ` : ''}
            ` : ''}

            <!-- Acceso adicional si cliente logueado quiere entrar como negocio -->
            ${clientUser && !bizUser && !devUser && SHOW_BIZ_SHORTCUTS ? `
              <button id="nav-biz-extra-btn" class="px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 hidden sm:flex items-center gap-1.5 transition-all" title="Acceso al panel de negocio">
                <i class="fas fa-store text-indigo-600"></i>
                <span>Soy Negocio</span>
              </button>
            ` : ''}
          </div>
        </div>
      </header>
    `;

    // Eventos de Navegación y Auth
    document.getElementById('nav-logo-btn')?.addEventListener('click', () => {
      this.navigateTo('directory');
    });

    document.getElementById('nav-directory-btn')?.addEventListener('click', () => this.navigateTo('directory'));
    document.getElementById('nav-plans-btn')?.addEventListener('click', () => this.renderPlansModal());
    document.getElementById('mobile-top-plans-btn')?.addEventListener('click', () => this.renderPlansModal());

    // Acciones móviles superiores
    document.getElementById('mobile-top-dev-badge')?.addEventListener('click', () => this.navigateTo('developer-dashboard'));
    document.getElementById('mobile-top-profile-badge')?.addEventListener('click', () => this.navigateTo('my-client-bookings'));
    document.getElementById('mobile-top-biz-badge')?.addEventListener('click', () => this.navigateTo('owner-dashboard'));
    document.getElementById('mobile-top-login-btn')?.addEventListener('click', () => this.renderAuthModal({ mode: 'login', role: 'client' }));

    // Developer logueado
    document.getElementById('nav-dev-dashboard-btn')?.addEventListener('click', () => this.navigateTo('developer-dashboard'));
    document.getElementById('nav-dev-logout-btn')?.addEventListener('click', () => {
      storage.logoutDeveloper();
      this.showToast('Sesión de Developer cerrada.', 'info');
      this.renderHeader();
      this.renderMobileBottomNav();
      if (this.currentView === 'developer-dashboard') this.navigateTo('directory');
    });

    // Botones Iniciar Sesión y Registrarse
    document.getElementById('nav-login-btn')?.addEventListener('click', () => this.renderAuthModal({ mode: 'login', role: 'client' }));
    document.getElementById('nav-register-btn')?.addEventListener('click', () => this.renderAuthModal({ mode: 'register', role: 'client' }));
    document.getElementById('nav-biz-extra-btn')?.addEventListener('click', () => this.renderAuthModal({ mode: 'login', role: 'business' }));

    // Cliente logueado
    document.getElementById('nav-client-bookings-btn')?.addEventListener('click', () => this.navigateTo('my-client-bookings'));
    document.getElementById('nav-client-logout-btn')?.addEventListener('click', () => {
      storage.logoutClient();
      this.showToast('Sesión de usuario cerrada.', 'info');
      this.renderHeader();
      this.renderMobileBottomNav();
      if (this.currentView === 'my-client-bookings') this.navigateTo('directory');
    });

    // Negocio logueado
    document.getElementById('nav-biz-dashboard-btn')?.addEventListener('click', () => this.navigateTo('owner-dashboard'));
    document.getElementById('nav-biz-logout-btn')?.addEventListener('click', () => {
      storage.logoutBusiness();
      this.showToast('Sesión de negocio cerrada.', 'info');
      this.renderHeader();
      this.renderMobileBottomNav();
      if (this.currentView === 'owner-dashboard') this.navigateTo('directory');
    });
  }

  // --- BARRA DE NAVEGACIÓN MÓVIL INFERIOR (ESTILO APP NATIVA - EXCLUSIVO CELULARES Y TABLETS) ---
  renderMobileBottomNav() {
    const navContainer = document.getElementById('mobile-bottom-nav-container');
    if (!navContainer) return;

    const devUser = storage.getDeveloperUser();
    const bizUser = storage.getBusinessUser();
    const clientUser = storage.getClientUser();

    const isDirectory = this.currentView === 'directory' || this.currentView === 'business-detail';
    const isBookings = this.currentView === 'my-client-bookings';
    const isOwner = this.currentView === 'owner-dashboard';
    const isDev = this.currentView === 'developer-dashboard';
    const showBizTab = !!bizUser || SHOW_BIZ_SHORTCUTS;
    const showAccountTab = !!clientUser || !!bizUser || !!devUser || SHOW_LOGIN_BUTTON;
    const colCount = 2 + (showBizTab ? 1 : 0) + (showAccountTab ? 1 : 0);
    const gridColsClass = colCount === 4 ? 'grid-cols-4' : (colCount === 3 ? 'grid-cols-3' : 'grid-cols-2');

    navContainer.innerHTML = `
      <div class="fixed bottom-0 inset-x-0 z-40 bottom-nav-blur border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 py-1 pb-safe md:hidden">
        <div class="max-w-md mx-auto grid ${gridColsClass} gap-1 text-center">
          
          <!-- 1. Explorar -->
          <button id="mobile-nav-explore-btn" class="app-touch-btn flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer ${isDirectory ? 'text-blue-600 font-extrabold' : 'text-slate-500 hover:text-slate-800 font-medium'}">
            <div class="w-8 h-8 flex items-center justify-center rounded-xl ${isDirectory ? 'bg-blue-50 text-blue-600' : ''}">
              <i class="fas fa-compass text-base ${isDirectory ? 'scale-110' : ''}"></i>
            </div>
            <span class="text-[10px] mt-0.5 tracking-tight">Explorar</span>
          </button>

          <!-- 2. Mis Reservas -->
          <button id="mobile-nav-bookings-btn" class="app-touch-btn flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer ${isBookings ? 'text-blue-600 font-extrabold' : 'text-slate-500 hover:text-slate-800 font-medium'}">
            <div class="w-8 h-8 flex items-center justify-center rounded-xl ${isBookings ? 'bg-blue-50 text-blue-600' : ''}">
              <i class="fas fa-calendar-alt text-base ${isBookings ? 'scale-110' : ''}"></i>
            </div>
            <span class="text-[10px] mt-0.5 tracking-tight">Mis Reservas</span>
          </button>

          <!-- 3. Mi Negocio (solo visible si hay negocio activo o si los accesos rápidos están habilitados) -->
          ${showBizTab ? `
          <button id="mobile-nav-biz-btn" class="app-touch-btn flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer ${isOwner ? 'text-indigo-600 font-extrabold' : 'text-slate-500 hover:text-slate-800 font-medium'}">
            <div class="w-8 h-8 flex items-center justify-center rounded-xl ${isOwner ? 'bg-indigo-50 text-indigo-600' : ''}">
              <i class="fas fa-store text-base ${isOwner ? 'scale-110' : ''}"></i>
            </div>
            <span class="text-[10px] mt-0.5 tracking-tight">${bizUser ? 'Mi Panel' : 'Soy Negocio'}</span>
          </button>
          ` : ''}

          <!-- 4. Cuenta / Dev -->
          ${devUser ? `
            <button id="mobile-nav-dev-btn" class="app-touch-btn flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer ${isDev ? 'text-amber-500 font-extrabold' : 'text-slate-500 hover:text-slate-800 font-medium'}">
              <div class="w-8 h-8 flex items-center justify-center rounded-xl ${isDev ? 'bg-amber-100 text-amber-600' : ''}">
                <i class="fas fa-shield-alt text-base ${isDev ? 'scale-110' : ''}"></i>
              </div>
              <span class="text-[10px] mt-0.5 tracking-tight">Developer</span>
            </button>
          ` : `
            <button id="mobile-nav-account-btn" class="app-touch-btn flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer ${clientUser || bizUser ? 'text-blue-600 font-extrabold' : 'text-slate-500 hover:text-slate-800 font-medium'}">
              <div class="w-8 h-8 flex items-center justify-center rounded-xl ${clientUser || bizUser ? 'bg-blue-50 text-blue-600' : ''}">
                <i class="fas fa-user-circle text-base"></i>
              </div>
              <span class="text-[10px] mt-0.5 tracking-tight">${clientUser ? (clientUser.name ? clientUser.name.split(' ')[0] : 'Perfil') : (bizUser ? 'Comercio' : 'Cuenta')}</span>
            </button>
          `}
          <!-- 4. Cuenta / Dev (solo si hay sesión iniciada o si SHOW_LOGIN_BUTTON está activo) -->
          ${showAccountTab ? `
            ${devUser ? `
              <button id="mobile-nav-dev-btn" class="app-touch-btn flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer ${isDev ? 'text-amber-500 font-extrabold' : 'text-slate-500 hover:text-slate-800 font-medium'}">
                <div class="w-8 h-8 flex items-center justify-center rounded-xl ${isDev ? 'bg-amber-100 text-amber-600' : ''}">
                  <i class="fas fa-shield-alt text-base ${isDev ? 'scale-110' : ''}"></i>
                </div>
                <span class="text-[10px] mt-0.5 tracking-tight">Developer</span>
              </button>
            ` : `
              <button id="mobile-nav-account-btn" class="app-touch-btn flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer ${clientUser || bizUser ? 'text-blue-600 font-extrabold' : 'text-slate-500 hover:text-slate-800 font-medium'}">
                <div class="w-8 h-8 flex items-center justify-center rounded-xl ${clientUser || bizUser ? 'bg-blue-50 text-blue-600' : ''}">
                  <i class="fas fa-user-circle text-base"></i>
                </div>
                <span class="text-[10px] mt-0.5 tracking-tight">${clientUser ? (clientUser.name ? clientUser.name.split(' ')[0] : 'Perfil') : (bizUser ? 'Comercio' : 'Cuenta')}</span>
              </button>
            `}
          ` : ''}

        </div>
      </div>
    `;

    // Eventos de la barra inferior móvil
    document.getElementById('mobile-nav-explore-btn')?.addEventListener('click', () => {
      this.navigateTo('directory');
    });

    document.getElementById('mobile-nav-bookings-btn')?.addEventListener('click', () => {
      this.navigateTo('my-client-bookings');
    });

    document.getElementById('mobile-nav-biz-btn')?.addEventListener('click', () => {
      if (bizUser) {
        this.navigateTo('owner-dashboard');
      } else {
        this.renderAuthModal({ mode: 'login', role: 'business' });
      }
    });

    document.getElementById('mobile-nav-dev-btn')?.addEventListener('click', () => {
      this.navigateTo('developer-dashboard');
    });

    document.getElementById('mobile-nav-account-btn')?.addEventListener('click', () => {
      if (clientUser) {
        this.navigateTo('my-client-bookings');
      } else if (bizUser) {
        this.navigateTo('owner-dashboard');
      } else {
        this.renderAuthModal({ mode: 'login', role: 'client' });
      }
    });
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
      case 'review-booking':
        this.renderReviewBookingView(main, this.currentRouteParams?.appointmentId || this.selectedAppointmentId, this.currentRouteParams?.rating);
        break;
      case 'owner-dashboard':
        this.renderOwnerDashboardView(main);
        break;
      case 'my-client-bookings':
        this.renderClientBookingsView(main);
        break;
      case 'developer-dashboard':
        this.renderDeveloperDashboardView(main);
        break;
      default:
        this.renderDirectoryView(main);
    }
  }

  // ==========================================
  // VISTA 1: DIRECTORIO DE NEGOCIOS (CLIENTE)
  // ==========================================
  filterBusinessesList(allBusinesses, query, categoryId) {
    let list = allBusinesses.filter(b => !b.isHidden && !b.isBlocked);
    
    if (categoryId && categoryId !== 'all') {
      list = list.filter(b => b.category === categoryId);
    }
    
    if (query && query.trim() !== '') {
      const cleanQ = this.normalizeText(query);
      const words = cleanQ.split(/\s+/).filter(w => w.length > 0);

      list = list.filter(biz => {
        const searchableFields = [
          biz.name,
          biz.categoryLabel,
          biz.category,
          biz.description,
          biz.city,
          biz.address,
          ...(biz.features || []),
          ...(biz.services ? biz.services.map(s => `${s.name} ${s.description || ''}`) : [])
        ];

        const fullHaystack = this.normalizeText(searchableFields.filter(Boolean).join(' '));
        return words.every(word => fullHaystack.includes(word));
      });
    }

    // Ordenamiento por Plan de Suscripción (Posición Preferencial para Plan Ilimitado y Pro)
    return list.sort((a, b) => {
      const planScore = { unlimited: 3, pro: 2, basic: 1 };
      const scoreA = planScore[a.plan] || 1;
      const scoreB = planScore[b.plan] || 1;
      if (scoreA !== scoreB) return scoreB - scoreA;
      // Desempate por rating o comercios reales
      if (Boolean(a.isDemo) !== Boolean(b.isDemo)) return a.isDemo ? 1 : -1;
      return (b.rating || 5) - (a.rating || 5);
    });
  }

  renderBusinessCard(biz) {
    const isUnlimited = biz.plan === 'unlimited';
    const isPro = biz.plan === 'pro';
    const isBlocked = Boolean(biz.isBlocked);
    const isDev = Boolean(storage.getDeveloperUser());

    return `
      <div class="bg-white rounded-3xl border ${isBlocked ? 'border-rose-300 ring-2 ring-rose-500/20 shadow-md bg-rose-50/10' : (isUnlimited ? 'border-purple-300 ring-2 ring-purple-500/10 shadow-md' : isPro ? 'border-amber-300 shadow-sm' : 'border-slate-200 shadow-xs')} overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col group hover:-translate-y-1 relative">
        <!-- Image Header -->
        <div class="relative h-52 overflow-hidden bg-slate-100">
          <img src="${biz.image || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80'}" alt="${this.escapeHtml(biz.name)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${isBlocked ? 'grayscale filter' : ''}" loading="lazy">
          <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30"></div>
          
          <!-- Badges de Plan y Tipo de Comercio -->
          <div class="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
            ${isBlocked ? `
              <span class="bg-rose-600 text-white backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-black flex items-center gap-1 shadow-lg border border-rose-400 animate-pulse">
                <i class="fas fa-ban"></i> Negocio Bloqueado
              </span>
            ` : isUnlimited ? `
              <span class="bg-gradient-to-r from-purple-700 to-indigo-700 text-white backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-black flex items-center gap-1 shadow-lg border border-purple-400/40 animate-pulse">
                <i class="fas fa-crown text-amber-300"></i> Top Destacado
              </span>
            ` : isPro ? `
              <span class="bg-amber-500 text-slate-950 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-black flex items-center gap-1 shadow-md border border-amber-300">
                <i class="fas fa-check-circle text-slate-950"></i> Negocio Verificado
              </span>
            ` : biz.isDemo ? `
              <span class="bg-purple-700/90 text-white backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-extrabold flex items-center gap-1 shadow-md border border-purple-400/40">
                <i class="fas fa-flask text-purple-200"></i> Comercio de Muestra
              </span>
            ` : `
              <span class="bg-emerald-600/90 text-white backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-extrabold flex items-center gap-1 shadow-md">
                <i class="fas fa-store text-emerald-200"></i> Negocio Registrado
              </span>
            `}
          </div>

          <!-- Rating Badge -->
          <div class="absolute top-3 right-3 bg-white/95 backdrop-blur-md text-slate-900 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-md">
            <i class="fas fa-star text-amber-400"></i>
            <span>${biz.rating || '5.0'}</span>
            <span class="text-slate-500 font-normal">(${biz.reviewsCount || 0})</span>
          </div>

          <!-- Ubicación sobre la imagen -->
          <div class="absolute bottom-3 left-3 text-white text-xs font-semibold flex items-center gap-1.5 drop-shadow-md">
            <i class="fas fa-map-marker-alt text-rose-400"></i>
            <span class="truncate max-w-[200px]">${this.escapeHtml(biz.city || 'Costa Rica')}</span>
          </div>
        </div>

        <!-- Content -->
        <div class="p-6 flex-1 flex flex-col justify-between">
          <div>
            <!-- Category Tag -->
            <div class="mb-2.5">
              <span class="text-[11px] font-bold tracking-wider uppercase text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100/80">
                ${this.escapeHtml(biz.categoryLabel || biz.category || 'General')}
              </span>
            </div>

            <!-- Name -->
            <h3 class="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
              ${this.escapeHtml(biz.name)}
            </h3>

            <!-- Description -->
            <p class="text-slate-600 text-xs mt-2 line-clamp-2 leading-relaxed">
              ${this.escapeHtml(biz.description || 'Servicios profesionales y atención personalizada.')}
            </p>

            <!-- Previsualización de Servicios Destacados -->
            <div class="mt-4 pt-4 border-t border-slate-100">
              <div class="space-y-1.5">
                ${biz.services && biz.services.length > 0 
                  ? biz.services.slice(0, 2).map(s => `
                    <div class="flex justify-between items-center text-xs py-0.5">
                      <span class="text-slate-600 truncate mr-2">${this.escapeHtml(s.name)}</span>
                      <span class="font-bold text-blue-600 shrink-0">₡${(s.price || 0).toLocaleString()}</span>
                    </div>
                  `).join('')
                  : '<span class="text-xs text-slate-500">Consultar catálogo</span>'
                }
              </div>
            </div>

            <!-- Schedule & Count -->
            <div class="mt-4 flex items-center justify-between text-xs text-slate-600 pt-3 border-t border-slate-50">
              <span class="flex items-center gap-1.5">
                <i class="far fa-clock text-blue-500"></i>
                ${biz.schedule ? `${this.formatTime(biz.schedule.openTime)} - ${this.formatTime(biz.schedule.closeTime)}` : 'Horario flexible'}
              </span>
              <span class="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                ${biz.services ? biz.services.length : 0} servicios
              </span>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="mt-5 pt-3 space-y-2.5">
            <button 
              class="view-biz-btn w-full py-2.5 px-4 ${isBlocked ? 'bg-slate-300 text-slate-600 cursor-not-allowed' : (isUnlimited ? 'bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800' : 'bg-slate-900 hover:bg-blue-600')} text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
              data-business-id="${biz.id}"
              ${isBlocked ? 'disabled title="Este comercio se encuentra temporalmente suspendido"' : ''}
            >
              <span>${isBlocked ? 'Comercio Bloqueado / Suspendido' : 'Ver Servicios & Reservar'}</span>
              <i class="fas ${isBlocked ? 'fa-lock' : 'fa-arrow-right'} text-xs"></i>
            </button>

            <!-- Barra de Administración Rápida de Negocios (Solo visible para Developer / SuperAdmin) -->
            ${isDev ? `
              <div class="pt-2 border-t border-slate-100 grid grid-cols-3 gap-1.5 bg-slate-50 p-2 rounded-2xl">
                <!-- 1. Bloquear / Desbloquear -->
                <button 
                  type="button"
                  class="card-toggle-block-btn py-2 px-1 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer shadow-2xs ${isBlocked ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-white text-rose-700 hover:bg-rose-50 border border-rose-200'}"
                  data-biz-id="${biz.id}"
                  data-biz-name="${this.escapeHtml(biz.name)}"
                  data-is-blocked="${isBlocked}"
                  title="${isBlocked ? 'Desbloquear negocio' : 'Bloquear negocio'}"
                >
                  <i class="fas ${isBlocked ? 'fa-unlock' : 'fa-ban'} text-xs"></i>
                  <span class="truncate">${isBlocked ? 'Desbloquear' : 'Bloquear'}</span>
                </button>

                <!-- 2. Modificar -->
                <button 
                  type="button"
                  class="card-edit-biz-btn py-2 px-1 rounded-xl text-[11px] font-bold bg-white text-blue-700 hover:bg-blue-50 border border-blue-200 transition-all flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                  data-biz-id="${biz.id}"
                  title="Modificar y editar información del negocio"
                >
                  <i class="fas fa-edit text-xs"></i>
                  <span>Modificar</span>
                </button>

                <!-- 3. Eliminar -->
                <button 
                  type="button"
                  class="card-delete-biz-btn py-2 px-1 rounded-xl text-[11px] font-bold bg-white text-slate-600 hover:bg-rose-600 hover:text-white border border-slate-200 transition-all flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                  data-biz-id="${biz.id}"
                  data-biz-name="${this.escapeHtml(biz.name)}"
                  title="Eliminar este negocio permanentemente"
                >
                  <i class="fas fa-trash-alt text-xs"></i>
                  <span>Eliminar</span>
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  renderDirectoryGridContent(businesses) {
    if (businesses.length === 0) {
      return `
        <div class="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8 max-w-md mx-auto shadow-xs">
          <div class="w-14 h-14 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-3 text-xl">
            <i class="fas fa-search"></i>
          </div>
          <h3 class="text-base font-bold text-slate-800">No encontramos comercios que coincidan</h3>
          <p class="text-xs text-slate-500 mt-1 leading-relaxed">Prueba con otra palabra clave, nombre de servicio o selecciona otra categoría.</p>
          <button id="reset-filter-btn" class="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer">
            <i class="fas fa-undo mr-1"></i> Ver todos los negocios
          </button>
        </div>
      `;
    }

    return `
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${businesses.map(biz => this.renderBusinessCard(biz)).join('')}
      </div>
    `;
  }

  renderDirectoryView(container) {
    const categories = storage.getCategories();
    const allBusinesses = storage.getBusinesses();
    const filteredBusinesses = this.filterBusinessesList(allBusinesses, this.searchQuery, this.selectedCategory);

    container.innerHTML = `
      <div class="animate-fade-in pb-20">
        <!-- 1. Banner Principal: Acceso Anticipado / Cupos de Prelanzamiento -->
        ${SHOW_PREREGISTER_BANNER ? `
        <section class="max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-1">
          <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white py-6 px-5 sm:py-8 sm:px-8 shadow-2xl border border-indigo-500/30">
            <!-- Efectos de Neón y Luces de Fondo -->
            <div class="absolute -top-24 -right-24 w-80 h-80 bg-blue-500/15 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
            <div class="absolute -bottom-24 -left-24 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl pointer-events-none"></div>

            <div class="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              
              <!-- Columna Principal de Texto e Incentivos -->
              <div class="lg:col-span-8 space-y-3.5 text-left">
                
                <!-- Badge Animado -->
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 text-amber-300 text-xs font-black uppercase tracking-wider border border-amber-400/40 shadow-xs shadow-amber-500/10">
                    <span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                    <span>🚀 PRÓXIMO LANZAMIENTO • ACCESO ANTICIPADO COSTA RICA 🇨🇷</span>
                  </span>
                </div>

                <!-- Titular de Impacto -->
                <h2 class="text-xl sm:text-2xl md:text-3xl font-black tracking-tight leading-tight">
                  ¿Tienes un negocio o prestas servicios? <span class="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400">Dile a tus clientes que pronto podrán reservar 24/7.</span>
                </h2>

                <!-- Propuesta de Valor -->
                <p class="text-xs sm:text-sm text-slate-200 font-medium leading-relaxed max-w-2xl">
                  Planes mensuales fijos <strong class="text-amber-300 font-black">($8, $15, $25/mes)</strong>. <span class="text-emerald-300 font-black underline decoration-emerald-400/50 underline-offset-2">Cero comisiones por reserva</span>. Recibe turnos directos por WhatsApp y ten tu enlace web propio con catálogo profesional listo para compartir.
                </p>

                <!-- Gancho / Incentivo de Prelanzamiento (Card Destacada) -->
                <div class="p-3 sm:p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-amber-400/40 text-xs text-amber-100 flex items-center gap-3 shadow-inner">
                  <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 flex items-center justify-center text-lg font-black flex-shrink-0 shadow-md shadow-amber-500/20">
                    🎁
                  </div>
                  <div>
                    <strong class="text-amber-300 font-black text-xs sm:text-sm block">Beneficio Pre-Registro:</strong>
                    <span class="text-slate-200 text-xs leading-snug">Los primeros <strong>20 comercios pre-registrados</strong> reciben <strong>15 días Gratis de bienvenida</strong> + <strong>Configuración de su catálogo en la página</strong>.</span>
                  </div>
                </div>

                <!-- Botones de Acción -->
                <div class="flex flex-wrap items-center gap-3 pt-1">
                  <button id="banner-preregister-btn" class="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 text-xs sm:text-sm font-black shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 cursor-pointer app-touch-btn">
                    <i class="fas fa-edit text-xs"></i>
                    <span>✍️ Pre-registrar Mi Negocio (Cupos Limitados)</span>
                  </button>
                  
                  <button id="banner-view-plans-btn" class="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white text-xs sm:text-sm font-bold border border-white/15 flex items-center justify-center gap-2 transition-all cursor-pointer app-touch-btn">
                    <i class="fas fa-tags text-amber-400 text-xs"></i>
                    <span>🏷️ Ver Planes y Beneficios</span>
                  </button>
                </div>

              </div>

              <!-- Columna Ilustrativa / Preview Card de Expectativa -->
              <div class="lg:col-span-4 flex justify-center">
                <div class="w-full max-w-[280px] bg-slate-900/90 rounded-2xl p-4 border border-indigo-500/30 shadow-xl backdrop-blur-md space-y-3">
                  <div class="flex items-center justify-between pb-2.5 border-b border-slate-800">
                    <div class="flex items-center gap-2">
                      <div class="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-400 to-yellow-500 flex items-center justify-center text-slate-950 text-xs font-black">
                        <i class="fas fa-store"></i>
                      </div>
                      <div>
                        <h4 class="text-xs font-black text-white leading-none">Tu Negocio Aquí</h4>
                        <p class="text-[10px] text-slate-400">reservascr.app/#/tu-local</p>
                      </div>
                    </div>
                    <span class="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[9px] font-black border border-amber-400/30">Pronto</span>
                  </div>

                  <div class="space-y-2 text-xs">
                    <div class="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <i class="fas fa-calendar-check text-blue-400 text-xs"></i>
                        <span class="text-slate-200 font-medium">Reservas 24/7</span>
                      </div>
                      <span class="text-emerald-400 font-bold">Activo</span>
                    </div>
                    <div class="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <i class="fab fa-whatsapp text-emerald-400 text-xs"></i>
                        <span class="text-slate-200 font-medium">WhatsApp Auto</span>
                      </div>
                      <span class="text-slate-300 text-[10px]">Instantáneo</span>
                    </div>
                  </div>

                  <div class="py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-400/30 text-center flex items-center justify-center gap-1.5 text-[11px] font-black text-amber-300">
                    <i class="fas fa-gift text-xs"></i>
                    <span>15 Días Gratis Pre-Registro</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>
        ` : ''}

        <!-- 2. Hero Section: Exploración y Búsqueda de Reservas -->
        <section class="relative bg-gradient-to-b from-blue-50/70 via-white to-slate-50 border-b border-slate-200/70 py-10 px-4 sm:px-6 lg:px-8 ${SHOW_BIZ_SHORTCUTS ? 'mt-4' : 'mt-1'}">
          <div class="max-w-4xl mx-auto text-center">
            <span class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100/80 text-blue-700 text-xs font-bold uppercase tracking-wider mb-3">
              <i class="fas fa-bolt text-blue-600"></i> Reserva tu turno en línea en Costa Rica
            </span>
            <h1 class="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Encuentra los mejores comercios y <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">agenda tu reserva al instante</span>
            </h1>
            <p class="mt-3 text-slate-600 text-sm sm:text-base max-w-2xl mx-auto">
              Barberías, spas, dentistas, talleres mecánicos y más. Escribe cualquier servicio o cantón para filtrar en tiempo real.
            </p>

            <!-- Buscador Inteligente -->
            <div class="mt-6 max-w-2xl mx-auto relative flex items-center shadow-lg rounded-2xl bg-white border border-slate-200 p-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
              <div class="pl-3.5 text-blue-600">
                <i class="fas fa-search text-base"></i>
              </div>
              <input 
                type="text" 
                id="search-input" 
                value="${this.searchQuery}" 
                placeholder="Busca por comercio, servicio ('corte', 'spa', 'frenos') o cantón..." 
                class="w-full px-3.5 py-2.5 text-slate-800 placeholder-slate-400 bg-transparent text-sm sm:text-base focus:outline-none"
                autocomplete="off"
              />
              <button id="clear-search-btn" class="${this.searchQuery ? '' : 'hidden'} p-2 text-slate-400 hover:text-slate-600 mr-1 transition-all cursor-pointer" title="Limpiar búsqueda">
                <i class="fas fa-times-circle text-base"></i>
              </button>
              <button id="do-search-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-blue-500/20 text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                <i class="fas fa-search text-xs"></i>
                <span>Buscar</span>
              </button>
            </div>

            ${REGISTRATION_ENABLED && SHOW_BIZ_SHORTCUTS ? `
            <!-- Mini Banner de Acceso / Registro para Negocios en Hero -->
            <div class="mt-5 inline-flex flex-wrap items-center justify-center gap-2 text-xs text-slate-600 bg-white/90 backdrop-blur-md py-1.5 px-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <span class="font-bold text-slate-800 flex items-center gap-1.5">
                <i class="fas fa-store text-indigo-600"></i> ¿Tienes un negocio o prestas servicios?
              </span>
              <button id="hero-register-biz-btn" class="font-black text-blue-600 hover:text-blue-800 underline decoration-2 underline-offset-2 flex items-center gap-1 transition-colors cursor-pointer">
                ¡Publica tu catálogo y recibe reservas aquí! <i class="fas fa-arrow-right text-[10px]"></i>
              </button>
            </div>
            ` : ''}
          </div>
        </section>

        <!-- 3. Filtro por Categorías -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <div class="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar" id="category-pills-container">
            ${categories.map(cat => `
              <button 
                class="category-pill-btn flex-shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-all cursor-pointer ${this.selectedCategory === cat.id ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'}"
                data-category-id="${cat.id}"
              >
                <i class="fas ${cat.icon} text-xs"></i>
                <span>${cat.name}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <!-- 4. Catálogo de Establecimientos (Contenedor Reactivo) -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
            <div>
              <h2 class="text-lg sm:text-xl font-bold text-slate-900" id="catalog-category-title">
                ${this.selectedCategory === 'all' ? 'Todos los Establecimientos' : categories.find(c => c.id === this.selectedCategory)?.name || 'Negocios'}
              </h2>
              <p class="text-xs text-slate-500 mt-0.5" id="catalog-count-text">
                ${this.searchQuery ? `Mostrando ${filteredBusinesses.length} resultados para "<strong>${this.escapeHtml(this.searchQuery)}</strong>"` : `${filteredBusinesses.length} comercios disponibles`}
              </p>
            </div>
          </div>

          <div id="catalog-grid-container">
            ${this.renderDirectoryGridContent(filteredBusinesses)}
          </div>
        </div>
      </div>
    `;

    // Listeners Inteligentes en Tiempo Real
    const searchInput = document.getElementById('search-input');
    const doSearchBtn = document.getElementById('do-search-btn');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const catalogGridContainer = document.getElementById('catalog-grid-container');
    const catalogCountText = document.getElementById('catalog-count-text');

    const attachCardListeners = () => {
      document.querySelectorAll('.view-biz-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const bId = btn.getAttribute('data-business-id');
          this.navigateTo('business-detail', { businessId: bId });
        });
      });

      // 1. Bloquear / Desbloquear negocio desde la tarjeta
      document.querySelectorAll('.card-toggle-block-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const bizId = btn.getAttribute('data-biz-id');
          const bizName = btn.getAttribute('data-biz-name');
          const isCurrentlyBlocked = btn.getAttribute('data-is-blocked') === 'true';

          if (isCurrentlyBlocked) {
            if (confirm(`¿Deseas DESBLOQUEAR el negocio "${bizName}" para que vuelva a recibir reservas?`)) {
              try {
                btn.disabled = true;
                await storage.toggleBusinessBlock(bizId, false, '');
                this.showToast(`El negocio "${bizName}" ha sido DESBLOQUEADO exitosamente.`, 'success');
                updateLiveSearch();
              } catch (err) {
                this.showToast(err.message || 'Error al desbloquear.', 'error');
                btn.disabled = false;
              }
            }
          } else {
            const reason = prompt(`¿Motivo de suspensión/bloqueo para "${bizName}"? (opcional):`, 'Suspensión administrativa temporal');
            if (reason !== null) {
              try {
                btn.disabled = true;
                await storage.toggleBusinessBlock(bizId, true, reason);
                this.showToast(`El negocio "${bizName}" ha sido BLOQUEADO/SUSPENDIDO.`, 'warning');
                updateLiveSearch();
              } catch (err) {
                this.showToast(err.message || 'Error al bloquear.', 'error');
                btn.disabled = false;
              }
            }
          }
        });
      });

      // 2. Modificar negocio desde la tarjeta
      document.querySelectorAll('.card-edit-biz-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const bizId = btn.getAttribute('data-biz-id');
          if (bizId) {
            this.renderEditBusinessModal(bizId);
          }
        });
      });

      // 3. Eliminar negocio desde la tarjeta
      document.querySelectorAll('.card-delete-biz-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const bizId = btn.getAttribute('data-biz-id');
          const bizName = btn.getAttribute('data-biz-name');
          if (confirm(`⚠️ ¿Estás seguro de que deseas ELIMINAR PERMANENTEMENTE el negocio "${bizName}"?\n\nEsta acción borrará el comercio, sus servicios y reservas asociadas en la base de datos.`)) {
            try {
              btn.disabled = true;
              await storage.deleteBusiness(bizId);
              this.showToast(`Negocio "${bizName}" eliminado definitivamente.`, 'success');
              updateLiveSearch();
            } catch (err) {
              this.showToast(err.message || 'Error al eliminar negocio.', 'error');
              btn.disabled = false;
            }
          }
        });
      });

      document.getElementById('reset-filter-btn')?.addEventListener('click', () => {
        this.searchQuery = '';
        this.selectedCategory = 'all';
        if (searchInput) searchInput.value = '';
        updateLiveSearch();
        this.renderCurrentView();
      });
    };

    const updateLiveSearch = () => {
      const q = searchInput ? searchInput.value : '';
      this.searchQuery = q;
      
      if (clearSearchBtn) {
        clearSearchBtn.classList.toggle('hidden', !q.trim());
      }

      const allBiz = storage.getBusinesses();
      const currentList = this.filterBusinessesList(allBiz, q, this.selectedCategory);

      if (catalogGridContainer) {
        catalogGridContainer.innerHTML = this.renderDirectoryGridContent(currentList);
      }

      if (catalogCountText) {
        catalogCountText.innerHTML = q.trim() 
          ? `Mostrando ${currentList.length} resultados para "<strong>${this.escapeHtml(q.trim())}</strong>"`
          : `${currentList.length} comercios disponibles`;
      }

      attachCardListeners();
    };

    // Filtrado en vivo mientras el usuario escribe
    searchInput?.addEventListener('input', () => {
      updateLiveSearch();
    });

    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        updateLiveSearch();
      }
    });

    doSearchBtn?.addEventListener('click', () => {
      updateLiveSearch();
    });

    clearSearchBtn?.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      updateLiveSearch();
    });

    // Píldoras de Categoría
    document.querySelectorAll('.category-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedCategory = btn.getAttribute('data-category-id');
        this.renderCurrentView();
      });
    });

    attachCardListeners();

    // Listeners para Banners de Negocios y Planes
    document.getElementById('banner-view-plans-btn')?.addEventListener('click', () => this.renderPlansModal());
    document.getElementById('hero-register-biz-btn')?.addEventListener('click', () => this.renderAuthModal({ mode: 'register', role: 'business' }));
    document.getElementById('cta-register-biz-btn')?.addEventListener('click', () => this.renderAuthModal({ mode: 'register', role: 'business' }));
    document.getElementById('cta-view-plans-btn')?.addEventListener('click', () => this.renderPlansModal());
    document.getElementById('cta-login-biz-btn')?.addEventListener('click', () => this.renderAuthModal({ mode: 'login', role: 'business' }));
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

    // Formatear enlaces de Redes Sociales
    const social = biz.socialLinks || biz.social_links || {};
    const formatIg = (val) => {
      if (!val || !val.trim()) return null;
      const c = val.trim();
      return c.startsWith('http') ? c : `https://instagram.com/${c.replace(/^@/, '')}`;
    };
    const formatFb = (val) => {
      if (!val || !val.trim()) return null;
      const c = val.trim();
      return c.startsWith('http') ? c : `https://facebook.com/${c}`;
    };
    const formatTt = (val) => {
      if (!val || !val.trim()) return null;
      const c = val.trim();
      return c.startsWith('http') ? c : `https://tiktok.com/${c.startsWith('@') ? c : `@${c}`}`;
    };
    const formatWeb = (val) => {
      if (!val || !val.trim()) return null;
      const c = val.trim();
      return c.startsWith('http') ? c : `https://${c}`;
    };

    const igUrl = formatIg(social.instagram);
    const fbUrl = formatFb(social.facebook);
    const ttUrl = formatTt(social.tiktok);
    const webUrl = formatWeb(social.website);
    const hasSocial = Boolean(igUrl || fbUrl || ttUrl || webUrl);

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
                ${biz.isBlocked ? `
                  <span class="px-3 py-1 rounded-full bg-rose-600 text-white text-xs font-black uppercase tracking-wider shadow-md">
                    <i class="fas fa-ban mr-1"></i> Comercio Suspendido
                  </span>
                ` : biz.isHidden ? `
                  <span class="px-3 py-1 rounded-full bg-amber-500 text-slate-950 text-xs font-black uppercase tracking-wider shadow-md">
                    <i class="fas fa-eye-slash mr-1"></i> Oculto de Inicio
                  </span>
                ` : biz.isDemo ? `
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
            ${biz.isBlocked ? `
              <div class="p-5 bg-rose-50 border border-rose-200 rounded-3xl flex items-center gap-4 text-rose-900 shadow-sm animate-fade-in">
                <div class="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center text-xl flex-shrink-0">
                  <i class="fas fa-ban"></i>
                </div>
                <div>
                  <h3 class="font-extrabold text-base text-rose-950">Comercio Suspendido Temporalmente</h3>
                  <p class="text-xs text-rose-700 mt-0.5">${biz.blockReason || 'Este comercio no está admitiendo reservas en este momento por disposición de la administración.'}</p>
                </div>
              </div>
            ` : ''}

            <!-- Servicios -->
            <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
              <h2 class="text-xl font-bold text-slate-900 mb-2">Servicios Disponibles</h2>
              <p class="text-sm text-slate-500 mb-6">Selecciona el servicio que deseas para ver turnos disponibles y agendar.</p>

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
                      ${biz.isBlocked ? `
                        <button disabled class="px-4 py-2.5 rounded-xl bg-slate-200 text-slate-400 text-xs font-bold cursor-not-allowed flex items-center gap-1.5">
                          <i class="fas fa-lock"></i> Suspendido
                        </button>
                      ` : `
                        <button 
                          class="book-service-btn px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center gap-1.5"
                          data-service-id="${srv.id}"
                        >
                          <i class="fas fa-calendar-plus"></i> Reservar
                        </button>
                      `}
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

            <!-- Reseñas y Calificaciones Verificadas -->
            <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div class="flex items-center gap-2">
                    <h2 class="text-xl font-bold text-slate-900">Opiniones de Clientes</h2>
                    <span class="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-black border border-emerald-200 flex items-center gap-1">
                      <i class="fas fa-shield-alt text-[10px]"></i> Verificadas
                    </span>
                  </div>
                  <p class="text-xs text-slate-500 mt-0.5">Calificaciones 100% auténticas de personas que completaron su reserva.</p>
                </div>

                <div class="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-2xl border border-slate-200/80">
                  <span class="text-3xl font-black text-slate-900">${biz.rating || 5.0}</span>
                  <div>
                    <div class="flex text-amber-400 text-xs">
                      ${Array(5).fill(0).map((_, i) => `<i class="${i < Math.round(biz.rating || 5) ? 'fas' : 'far'} fa-star"></i>`).join('')}
                    </div>
                    <span class="text-[11px] font-bold text-slate-500">${biz.reviewsCount || 0} valoraciones</span>
                  </div>
                </div>
              </div>

              <div id="biz-reviews-container" class="space-y-4">
                <div class="flex items-center justify-center py-6 text-slate-400 gap-2 text-xs">
                  <i class="fas fa-circle-notch fa-spin text-blue-600"></i> Cargando opiniones verificadas...
                </div>
              </div>
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
                <div class="pt-3 border-t border-slate-100">
                  <a href="https://wa.me/${biz.phone.replace(/[^0-9]/g, '')}" target="_blank" rel="noopener noreferrer" class="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs">
                    <i class="fab fa-whatsapp text-sm"></i> Chatear por WhatsApp
                  </a>
                </div>
              ` : ''}

              <!-- Redes Sociales y Enlaces Oficiales -->
              ${hasSocial ? `
                <div class="pt-3 border-t border-slate-100 space-y-2.5">
                  <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Redes Sociales & Web</span>
                  <div class="flex flex-wrap items-center gap-2">
                    ${igUrl ? `
                      <a href="${igUrl}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs hover:opacity-95 transition-opacity" title="Instagram">
                        <i class="fab fa-instagram"></i> Instagram
                      </a>
                    ` : ''}
                    ${fbUrl ? `
                      <a href="${fbUrl}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 rounded-xl bg-[#1877F2] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs hover:opacity-95 transition-opacity" title="Facebook">
                        <i class="fab fa-facebook"></i> Facebook
                      </a>
                    ` : ''}
                    ${ttUrl ? `
                      <a href="${ttUrl}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs hover:bg-black transition-colors" title="TikTok">
                        <i class="fab fa-tiktok"></i> TikTok
                      </a>
                    ` : ''}
                    ${webUrl ? `
                      <a href="${webUrl}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs hover:bg-indigo-700 transition-colors" title="Sitio Web">
                        <i class="fas fa-globe"></i> Sitio Web
                      </a>
                    ` : ''}
                  </div>
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
                  <span class="font-bold text-slate-800">${biz.schedule ? `${this.formatTime12h(biz.schedule.openTime)} - ${this.formatTime12h(biz.schedule.closeTime)}` : '8:00 AM - 6:00 PM'}</span>
                </div>
                ${biz.schedule && biz.schedule.breakStart ? `
                  <div class="flex justify-between py-1.5 text-amber-700 bg-amber-50 px-2 rounded-lg">
                    <span class="font-medium">Receso / Almuerzo:</span>
                    <span class="font-bold">${this.formatTime12h(biz.schedule.breakStart)} - ${this.formatTime12h(biz.schedule.breakEnd)}</span>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Cargar opiniones del negocio de forma asíncrona
    storage.getBusinessReviews(biz.id).then(reviews => {
      const revBox = document.getElementById('biz-reviews-container');
      if (!revBox) return;

      if (reviews && reviews.length > 0) {
        revBox.innerHTML = reviews.map(rev => `
          <div class="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                  ${(rev.clientName || 'C').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div class="flex items-center gap-1.5">
                    <span class="font-bold text-xs text-slate-900">${this.escapeHtml(rev.clientName)}</span>
                    <span class="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-semibold">✓ Verificado</span>
                  </div>
                  <span class="text-[11px] text-blue-600 font-medium">Servicio: ${this.escapeHtml(rev.serviceName || 'Atención')}</span>
                </div>
              </div>
              <div class="text-right">
                <div class="flex text-amber-400 text-xs">
                  ${Array(5).fill(0).map((_, i) => `<i class="${i < rev.rating ? 'fas' : 'far'} fa-star"></i>`).join('')}
                </div>
                <span class="text-[10px] text-slate-400">${this.formatDateDMY(rev.createdAt ? rev.createdAt.split('T')[0] : '')}</span>
              </div>
            </div>
            ${rev.comment ? `
              <p class="text-xs text-slate-700 leading-relaxed italic bg-white p-3 rounded-xl border border-slate-100">
                "${this.escapeHtml(rev.comment)}"
              </p>
            ` : ''}
          </div>
        `).join('');
      } else {
        revBox.innerHTML = `
          <div class="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <i class="far fa-comment-dots text-slate-300 text-3xl mb-2 block"></i>
            <p class="text-xs text-slate-500 font-medium">Aún no hay opiniones escritas para este comercio.</p>
            <p class="text-[11px] text-slate-400 mt-1">Los clientes reciben un correo de valoración automáticamente al finalizar su turno.</p>
          </div>
        `;
      }
    });

    document.getElementById('back-to-directory-btn')?.addEventListener('click', () => this.goBack());

    document.querySelectorAll('.book-service-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sId = btn.getAttribute('data-service-id');
        this.openBookingModal(biz.id, sId);
      });
    });
  }

  // ==========================================
  // VISTA: PANTALLA DE CALIFICACIÓN Y RESEÑA VERIFICADA (#/calificar/:id)
  // ==========================================
  async renderReviewBookingView(container, appointmentId, preselectedRating = null, allowEdit = false) {
    if (!appointmentId) {
      this.navigateTo('directory');
      return;
    }

    container.innerHTML = `
      <div class="max-w-xl mx-auto px-4 py-12 animate-fade-in">
        <div class="flex items-center justify-center py-20 text-slate-400 gap-3">
          <i class="fas fa-circle-notch fa-spin text-2xl text-blue-600"></i>
          <span class="font-medium text-slate-600">Cargando datos de tu reserva...</span>
        </div>
      </div>
    `;

    const info = await storage.getReviewInfo(appointmentId);
    if (info.error || !info.appointment) {
      container.innerHTML = `
        <div class="max-w-md mx-auto my-12 p-8 bg-white rounded-3xl border border-slate-200 text-center shadow-lg animate-fade-in">
          <div class="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
            <i class="fas fa-exclamation-circle"></i>
          </div>
          <h2 class="text-xl font-bold text-slate-900 mb-2">No pudimos encontrar la reserva</h2>
          <p class="text-xs text-slate-500 mb-6">${info.error || 'El código de la reserva no es válido o ha expirado.'}</p>
          <button id="review-go-home-btn" class="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-md hover:bg-blue-700 transition-all text-xs">
            Ir al Inicio
          </button>
        </div>
      `;
      document.getElementById('review-go-home-btn')?.addEventListener('click', () => this.navigateTo('directory'));
      return;
    }

    const { appointment: apt, alreadyReviewed, review } = info;
    let currentSelectedRating = preselectedRating && preselectedRating >= 1 && preselectedRating <= 5 ? preselectedRating : (review ? review.rating : 5);

    const ratingLabels = {
      1: 'Malo 😞',
      2: 'Regular 😐',
      3: 'Bueno 🙂',
      4: 'Muy Bueno 😊',
      5: '¡Excelente! 🤩'
    };

    if (alreadyReviewed && review && !allowEdit) {
      container.innerHTML = `
        <div class="max-w-lg mx-auto px-4 py-10 animate-fade-in">
          <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xl text-center space-y-6">
            <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl shadow-md">
              <i class="fas fa-check"></i>
            </div>
            
            <div>
              <span class="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-extrabold border border-emerald-200 inline-flex items-center gap-1.5">
                <i class="fas fa-shield-alt text-[11px]"></i> Reseña Verificada Publicada
              </span>
              <h1 class="text-2xl font-black text-slate-900 mt-3">¡Ya calificaste esta atención!</h1>
              <p class="text-xs text-slate-500 mt-1">Muchas gracias por apoyar la transparencia y calidad de los negocios locales en Costa Rica.</p>
            </div>

            <!-- Resumen de su calificación -->
            <div class="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 text-left space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="font-black text-slate-900 text-sm">${apt.businessName}</h3>
                  <span class="text-xs text-blue-600 font-semibold">${apt.serviceName}</span>
                </div>
                <div class="flex text-amber-400 text-base">
                  ${Array(5).fill(0).map((_, i) => `<i class="${i < review.rating ? 'fas' : 'far'} fa-star"></i>`).join('')}
                </div>
              </div>
              ${review.comment ? `
                <p class="text-xs text-slate-700 italic bg-white p-3 rounded-xl border border-slate-100">
                  "${this.escapeHtml(review.comment)}"
                </p>
              ` : ''}
              <div class="text-[11px] text-slate-400">Fecha de visita: ${this.formatDateDMY(apt.date)}</div>
            </div>

            <div class="flex flex-col sm:flex-row items-center gap-3 justify-center pt-2">
              <button id="edit-review-btn" class="w-full sm:w-auto px-5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                <i class="fas fa-edit"></i> Modificar mi Calificación
              </button>
              <button id="view-biz-page-btn" class="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20">
                Ver Ficha de ${apt.businessName}
              </button>
              <button id="go-explore-home-btn" class="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all">
                Explorar Más Comercios
              </button>
            </div>
          </div>
        </div>
      `;

      document.getElementById('edit-review-btn')?.addEventListener('click', () => {
        this.renderReviewBookingView(container, appointmentId, review?.rating, true);
      });
      document.getElementById('view-biz-page-btn')?.addEventListener('click', () => {
        this.navigateTo('business-detail', { businessId: apt.businessId });
      });
      document.getElementById('go-explore-home-btn')?.addEventListener('click', () => {
        this.navigateTo('directory');
      });
      return;
    }

    // Formulario de Calificación
    container.innerHTML = `
      <div class="max-w-xl mx-auto px-4 py-8 sm:py-12 animate-fade-in">
        <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xl space-y-6">
          
          <!-- Encabezado de la Cita -->
          <div class="text-center space-y-2 pb-4 border-b border-slate-100">
            <span class="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-extrabold border border-blue-200/80 inline-flex items-center gap-1.5">
              <i class="fas fa-shield-alt text-[11px] text-blue-600"></i> Calificación Verificada por Reserva Real
            </span>
            <h1 class="text-2xl sm:text-3xl font-black text-slate-900">¿Cómo estuvo tu atención?</h1>
            <p class="text-xs text-slate-500">Tu opinión ayuda al comercio a mejorar y a otros clientes a elegir el mejor servicio.</p>
          </div>

          <!-- Tarjeta del Comercio & Servicio -->
          <div class="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div class="w-14 h-14 rounded-xl overflow-hidden bg-slate-200 flex-shrink-0 border border-slate-200">
              <img src="${apt.businessImage || './src/assets/logo.svg'}" alt="${apt.businessName}" class="w-full h-full object-cover">
            <div class="w-14 h-14 rounded-xl overflow-hidden bg-white flex-shrink-0 border border-slate-200">
              <img src="${apt.businessImage || './src/assets/reservas_cr_clean_badge_1.jpg'}" alt="${apt.businessName}" class="w-full h-full object-cover">
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-extrabold text-sm text-slate-900 truncate">${apt.businessName}</h3>
              <p class="text-xs text-blue-600 font-bold">${apt.serviceName}</p>
              <p class="text-[11px] text-slate-400 mt-0.5">Atendido el ${this.formatDateDMY(apt.date)} • ${this.formatTime12h(apt.time)}</p>
            </div>
          </div>

          <!-- Selector Interactivo de Estrellas -->
          <form id="review-submission-form" class="space-y-6">
            <div class="text-center space-y-3">
              <label class="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                Selecciona tu puntuación:
              </label>
              
              <div class="flex items-center justify-center gap-2 sm:gap-3 py-2" id="star-rating-selector">
                ${[1, 2, 3, 4, 5].map(num => `
                  <button 
                    type="button" 
                    class="star-select-btn text-3xl sm:text-4xl transition-transform hover:scale-125 focus:outline-none cursor-pointer ${num <= currentSelectedRating ? 'text-amber-400' : 'text-slate-300'}" 
                    data-rating="${num}"
                    title="${ratingLabels[num]}"
                  >
                    ★
                  </button>
                `).join('')}
              </div>

              <div id="rating-label-display" class="text-sm font-black text-blue-600 transition-all">
                ${ratingLabels[currentSelectedRating]}
              </div>
            </div>

            <!-- Comentario -->
            <div class="space-y-1.5">
              <label for="review-comment" class="block text-xs font-bold text-slate-700">
                Tu opinión o comentario (Opcional):
              </label>
              <textarea 
                id="review-comment" 
                rows="4" 
                class="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-xs text-slate-800 transition-all resize-none"
                placeholder="Cuéntanos qué tal la puntualidad, el trato del personal, las instalaciones y si recomendarías el lugar..."
              ></textarea>
              >${allowEdit && review?.comment ? this.escapeHtml(review.comment) : ''}</textarea>
            </div>

            <!-- Botón de Envío -->
            <button 
              type="submit" 
              id="submit-review-btn" 
              class="w-full py-3.5 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
            >
              <i class="fas fa-paper-plane"></i> Publicar Reseña Verificada
            </button>
          </form>

        </div>
      </div>
    `;

    // Listeners del selector de estrellas
    const starBtns = document.querySelectorAll('.star-select-btn');
    const labelDisplay = document.getElementById('rating-label-display');

    const updateStarsVisual = (rating) => {
      starBtns.forEach(btn => {
        const r = parseInt(btn.getAttribute('data-rating'), 10);
        if (r <= rating) {
          btn.classList.remove('text-slate-300');
          btn.classList.add('text-amber-400');
        } else {
          btn.classList.remove('text-amber-400');
          btn.classList.add('text-slate-300');
        }
      });
      if (labelDisplay) {
        labelDisplay.textContent = ratingLabels[rating] || '';
      }
    };

    starBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        currentSelectedRating = parseInt(btn.getAttribute('data-rating'), 10);
        updateStarsVisual(currentSelectedRating);
      });
      btn.addEventListener('mouseenter', () => {
        const hoverRating = parseInt(btn.getAttribute('data-rating'), 10);
        updateStarsVisual(hoverRating);
      });
    });

    document.getElementById('star-rating-selector')?.addEventListener('mouseleave', () => {
      updateStarsVisual(currentSelectedRating);
    });

    // Envío del Formulario
    document.getElementById('review-submission-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('submit-review-btn');
      const comment = document.getElementById('review-comment')?.value || '';

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Publicando reseña...';
      }

      try {
        const res = await storage.submitReview({
          appointmentId: apt.id,
          rating: currentSelectedRating,
          comment: comment.trim()
        });

        this.showToast('¡Muchas gracias! Tu reseña ha sido publicada con éxito.', 'success');
        
        // Renderizar vista de agradecimiento
        await this.renderReviewBookingView(container, appointmentId);
      } catch (err) {
        console.error('Error enviando reseña:', err);
        this.showToast(err.message || 'No se pudo publicar la reseña.', 'error');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Publicar Reseña Verificada';
        }
      }
    });
  }

  // ==========================================
  // MODAL DE RESERVA EN TIEMPO REAL (FLUJO CLIENTE)
  // ==========================================
  openBookingModal(businessId, serviceId) {
    this.bookingState = {
      isOpen: true,
      businessId,
      serviceId,
      staffId: 'any',
      selectedDate: this.getTodayDateString(),
      selectedTime: null
    };

    // Asegurar carga fresca de especialistas
    storage.getBusinessStaff(businessId).then(() => {
      if (this.bookingState.isOpen && this.bookingState.businessId === businessId) {
        this.renderBookingModal();
      }
    }).catch(() => {});

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
    const service = biz?.services?.find(s => s.id === this.bookingState.serviceId) || biz?.services?.[0];
    if (!biz || !service) return;

    // Obtener especialistas activos calificados para este servicio
    const allStaff = (storage.getBusinessStaffSync(biz.id) || []).filter(s => s.isActive !== false);
    const qualifiedStaff = allStaff.filter(st => {
      if (!st.services || st.services.length === 0 || st.services.includes('all')) return true;
      return st.services.includes(service.id);
    });

    const hasMultipleStaff = qualifiedStaff.length >= 2;
    const selectedStaffId = this.bookingState.staffId || 'any';

    const availability = storage.getAvailableSlots(
      biz.id, 
      this.bookingState.selectedDate, 
      service.duration, 
      null, 
      selectedStaffId, 
      service.id
    );
    const clientUser = storage.getClientUser();

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 modal-backdrop animate-fade-in overflow-y-auto">
        <div class="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 my-0 sm:my-8 mobile-bottom-sheet flex flex-col max-h-[92vh]">
          <!-- Header -->
          <div class="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 sm:p-6 text-white flex items-center justify-between shrink-0">
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

            <!-- Paso 1: Seleccionar Especialista (si hay 2 o más especialistas calificados) -->
            ${hasMultipleStaff ? `
              <div>
                <div class="flex items-center justify-between mb-2">
                  <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    1. ¿Con quién deseas atenderte?
                  </label>
                  <span class="text-[11px] text-blue-600 font-bold">${qualifiedStaff.length} especialistas</span>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <!-- Tarjeta: Cualquiera disponible -->
                  <button 
                    type="button" 
                    class="staff-select-card p-2.5 rounded-2xl border text-left transition-all flex items-center gap-2.5 cursor-pointer ${selectedStaffId === 'any' ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-500/20 shadow-xs' : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/80 text-slate-700'}"
                    data-staff-id="any"
                  >
                    <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xs font-black shrink-0">
                      <i class="fas fa-bolt"></i>
                    </div>
                    <div class="min-w-0">
                      <div class="text-xs font-bold text-slate-900 truncate">Cualquiera</div>
                      <div class="text-[10px] text-slate-500 truncate">Más turnos libres</div>
                    </div>
                  </button>

                  <!-- Tarjetas de cada Especialista -->
                  ${qualifiedStaff.map(st => `
                    <button 
                      type="button" 
                      class="staff-select-card p-2.5 rounded-2xl border text-left transition-all flex items-center gap-2.5 cursor-pointer ${selectedStaffId === st.id ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-500/20 shadow-xs' : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/80 text-slate-700'}"
                      data-staff-id="${st.id}"
                    >
                      ${st.avatarUrl ? `
                        <img src="${st.avatarUrl}" alt="${st.name}" class="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200">
                      ` : `
                        <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-700 to-slate-900 text-white flex items-center justify-center text-xs font-black shrink-0">
                          ${st.name.charAt(0).toUpperCase()}
                        </div>
                      `}
                      <div class="min-w-0">
                        <div class="text-xs font-bold text-slate-900 truncate">${st.name.split(' ')[0]}</div>
                        <div class="text-[10px] text-slate-500 truncate">${st.roleTitle || 'Especialista'}</div>
                      </div>
                    </button>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- Paso 2: Seleccionar Fecha -->
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                ${hasMultipleStaff ? '2. Selecciona la Fecha' : '1. Selecciona la Fecha'}
              </label>
              <input 
                type="date" 
                id="booking-date-input" 
                value="${this.bookingState.selectedDate}" 
                min="${this.getTodayDateString()}" 
                class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
              />
            </div>

            <!-- Paso 3: Horarios Disponibles en Tiempo Real -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  ${hasMultipleStaff ? '3. Horario Disponible' : '2. Horario Disponible'} (${availability.slots ? availability.slots.length : 0} libres)
                </label>
                ${this.bookingState.selectedTime ? `
                  <span class="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                    Elegido: ${this.formatTime12h(this.bookingState.selectedTime)}
                  </span>
                ` : ''}
              </div>

              ${availability.isClosed ? `
                <div class="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-2">
                  <i class="fas fa-calendar-times text-base"></i>
                  <span>${availability.reason}</span>
                </div>
              ` : availability.slots.length === 0 ? `
                <div class="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs flex items-center gap-2">
                  <i class="fas fa-info-circle text-base"></i>
                  <span>No hay turnos disponibles para esta fecha o especialista. Intenta con otro día o especialista.</span>
                </div>
              ` : `
                <div class="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto p-1">
                  ${availability.slots.map(slot => `
                    <button 
                      type="button" 
                      class="time-slot-btn py-2.5 px-3 text-xs font-bold rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50 text-slate-700 text-center cursor-pointer transition-all ${this.bookingState.selectedTime === slot ? 'selected bg-blue-600 text-white border-blue-600 shadow-md' : ''}"
                      data-slot="${slot}"
                    >
                      ${this.formatTime12h(slot)}
                    </button>
                  `).join('')}
                </div>
              `}
            </div>

            <!-- Paso 4: Identificación / Datos del Cliente -->
            <form id="booking-form" class="space-y-3 pt-3 border-t border-slate-100">
              <div class="flex items-center justify-between">
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  ${hasMultipleStaff ? '4. Tus Datos para la Reserva' : '3. Tus Datos para la Reserva'}
                </label>
                ${clientUser ? `
                  <span class="text-[11px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                    <i class="fas fa-check-circle mr-1"></i> Sesión activa
                  </span>
                ` : `
                  <span class="text-[11px] text-slate-400">Sin contraseñas complicadas</span>
                `}
              </div>

              <div>
                <input 
                  type="text" 
                  id="client-name" 
                  value="${clientUser ? clientUser.name : ''}"
                  placeholder="Nombre y Apellidos *" 
                  required 
                  class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input 
                  type="tel" 
                  id="client-phone" 
                  value="${clientUser ? clientUser.phone : ''}"
                  placeholder="Teléfono / WhatsApp (+506) *" 
                  required 
                  class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <input 
                  type="email" 
                  id="client-email" 
                  value="${clientUser ? clientUser.email || '' : ''}"
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

              <!-- Consentimiento previo (Opt-in) Notificaciones WhatsApp -->
              <div class="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-2xl">
                <label class="flex items-start gap-3 cursor-pointer select-none">
                  <input type="checkbox" id="client-whatsapp-optin" checked class="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-emerald-300">
                  <div class="text-xs text-slate-700 leading-snug">
                    <div class="font-bold text-emerald-800 flex items-center gap-1.5 mb-0.5">
                      <i class="fab fa-whatsapp text-emerald-600 text-sm"></i>
                      <span>Confirmación de Reserva por WhatsApp</span>
                    </div>
                    <p class="text-slate-600 text-[11px]">
                      Acepto recibir el mensaje de confirmación de esta reserva y recordatorios del turno por WhatsApp a mi número de teléfono.
                    </p>
                  </div>
                </label>
              </div>

              <!-- Submit button -->
              <button 
                type="submit" 
                id="submit-booking-btn"
                ${!this.bookingState.selectedTime ? 'disabled' : ''}
                class="w-full mt-4 py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-bold shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <i class="fas fa-check-circle"></i>
                <span>Confirmar Reserva ${this.bookingState.selectedTime ? `(${this.formatTime12h(this.bookingState.selectedTime)})` : ''}</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    `;

    document.getElementById('close-modal-btn')?.addEventListener('click', () => this.closeBookingModal());

    // Selección de Especialista
    document.querySelectorAll('.staff-select-card').forEach(card => {
      card.addEventListener('click', () => {
        const staffId = card.getAttribute('data-staff-id');
        this.bookingState.staffId = staffId;
        this.bookingState.selectedTime = null;
        this.renderBookingModal();
      });
    });

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
      const whatsappOptIn = document.getElementById('client-whatsapp-optin')?.checked ?? true;

      // Guardar o actualizar sesión de cliente
      await storage.loginOrRegisterClient(clientName, clientPhone, clientEmail, whatsappOptIn);
      this.renderHeader();

      const isAutoConfirm = biz.autoConfirmAppointments !== false;
      const initialStatus = isAutoConfirm ? 'confirmed' : 'pending';

      const assignedStaffId = this.bookingState.staffId && this.bookingState.staffId !== 'any' ? this.bookingState.staffId : null;
      const assignedStaffObj = assignedStaffId ? qualifiedStaff.find(s => s.id === assignedStaffId) : null;
      const assignedStaffName = assignedStaffObj ? `${assignedStaffObj.name}${assignedStaffObj.roleTitle ? ' (' + assignedStaffObj.roleTitle + ')' : ''}` : null;

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
        whatsappOptIn,
        status: initialStatus,
        staffId: assignedStaffId,
        staffName: assignedStaffName
      });

      this.closeBookingModal();
      this.renderSuccessBookingModal(newAppointment, biz);
      if (newAppointment.status === 'pending') {
        this.showToast('¡Solicitud enviada! En unos minutos recibirás la confirmación del negocio.', 'info');
      } else {
        this.showToast('¡Reserva confirmada con éxito!', 'success');
      }
    });
  }

  // --- MODAL DE ÉXITO DE RESERVA (CONFIRMADA O PENDIENTE) ---
  renderSuccessBookingModal(appointment, business) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const isPending = appointment.status === 'pending';

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop animate-fade-in">
        <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 text-center p-6 sm:p-8">
          <div class="w-16 h-16 ${isPending ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'} rounded-full flex items-center justify-center text-3xl mx-auto mb-4 ${isPending ? 'animate-pulse' : 'animate-bounce'}">
            <i class="fas ${isPending ? 'fa-hourglass-half' : 'fa-check'}"></i>
          </div>

          <span class="text-xs uppercase font-extrabold ${isPending ? 'text-amber-600' : 'text-emerald-600'} tracking-wider">
            ${isPending ? '¡Solicitud de Reserva Recibida!' : '¡Turno Agendado!'}
          </span>
          <h3 class="text-2xl font-black text-slate-900 mt-1">
            ${isPending ? 'Reserva en Proceso de Confirmación' : 'Reserva Confirmada'}
          </h3>
          <p class="text-xs text-slate-500 mt-1">Código de reserva: <strong class="text-slate-800 font-mono">${appointment.id.toUpperCase()}</strong></p>

          ${isPending ? `
            <!-- Aviso Informativo para Reserva Pendiente -->
            <div class="mt-4 p-4 bg-amber-50/90 rounded-2xl border border-amber-200 text-left text-xs text-amber-900 space-y-1.5 animate-fade-in">
              <div class="flex items-center gap-2 font-bold text-amber-950">
                <i class="fas fa-clock text-amber-600 text-sm"></i>
                <span>En unos minutos te llegará la confirmación</span>
              </div>
              <p class="text-amber-800 text-[11px] leading-relaxed">
                Tu solicitud ha sido enviada al comercio <strong>${business.name}</strong>. En unos minutos te llegará la confirmación por parte del negocio vía correo y WhatsApp una vez sea revisada y aprobada.
              </p>
            </div>
          ` : ''}

          <div class="mt-5 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left text-xs space-y-2.5">
            <div class="flex justify-between">
              <span class="text-slate-500">Establecimiento:</span>
              <span class="font-bold text-slate-800">${business.name}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Servicio:</span>
              <span class="font-bold text-slate-800">${appointment.serviceName}</span>
            </div>
            ${appointment.staffName ? `
              <div class="flex justify-between">
                <span class="text-slate-500">Especialista:</span>
                <span class="font-bold text-blue-700 flex items-center gap-1">
                  <i class="fas fa-user-tag text-blue-500 text-[11px]"></i>
                  ${appointment.staffName}
                </span>
              </div>
            ` : ''}
            <div class="flex justify-between">
              <span class="text-slate-500">Fecha y Hora:</span>
              <span class="font-bold text-blue-600">${this.formatDateDMY(appointment.date)} a las ${this.formatTime12h(appointment.time)}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Estado:</span>
              <span class="font-bold ${isPending ? 'text-amber-600' : 'text-emerald-600'} flex items-center gap-1">
                <i class="fas ${isPending ? 'fa-clock' : 'fa-check-circle'} text-[11px]"></i>
                ${isPending ? 'Pendiente de aprobación' : 'Confirmada al instante'}
              </span>
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

          ${!isPending && appointment.whatsappOptIn !== false ? `
            <div class="mt-4 p-3 bg-emerald-50/90 rounded-2xl border border-emerald-200 flex items-center gap-3 text-xs text-emerald-800 font-medium text-left animate-fade-in">
              <div class="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 text-base shadow-sm">
                <i class="fab fa-whatsapp"></i>
              </div>
              <div>
                <strong class="block text-emerald-950 font-bold text-[11px] uppercase tracking-wider">Confirmación WhatsApp enviada</strong>
                <span class="text-[11px] text-emerald-700">Se enviará el comprobante y recordatorios a tu número <strong>${appointment.clientPhone}</strong>.</span>
              </div>
            </div>
          ` : ''}

          <div class="mt-6 flex flex-col gap-2">
            <button id="success-view-bookings-btn" class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer">
              Ver Mis Reservas
            </button>
            <button id="success-done-btn" class="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer">
              Seguir Explorando
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('success-view-bookings-btn')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
      this.navigateTo('my-client-bookings');
    });

    document.getElementById('success-done-btn')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
      this.renderCurrentView();
    });
  }

  // ==========================================
  // MODAL DE REPROGRAMACIÓN / EDICIÓN DE CITAS
  // ==========================================
  renderRescheduleModal(appointment, isOwnerMode = false) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer || !appointment) return;

    const biz = storage.getBusinessById(appointment.businessId);
    if (!biz) {
      this.showToast('No se encontró el negocio asociado a esta reserva.', 'error');
      return;
    }

    let selectedServiceId = appointment.serviceId || (biz.services && biz.services[0]?.id);
    let selectedDate = appointment.date || this.getTodayDateString();
    let selectedTime = appointment.time;
    let currentService = biz.services?.find(s => s.id === selectedServiceId) || {
      id: appointment.serviceId,
      name: appointment.serviceName,
      price: appointment.servicePrice,
      duration: appointment.serviceDuration || 30
    };

    const renderModalContent = () => {
      currentService = biz.services?.find(s => s.id === selectedServiceId) || currentService;
      const duration = currentService?.duration || 30;
      const availability = storage.getAvailableSlots(biz.id, selectedDate, duration, appointment.id);

      modalContainer.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop animate-fade-in overflow-y-auto">
          <div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 my-8">
            <!-- Header -->
            <div class="bg-gradient-to-r ${isOwnerMode ? 'from-indigo-700 to-blue-700' : 'from-blue-600 to-indigo-600'} p-6 text-white flex items-center justify-between">
              <div>
                <span class="text-xs uppercase tracking-wider text-blue-200 font-bold">
                  <i class="fas ${isOwnerMode ? 'fa-user-cog' : 'fa-calendar-alt'} mr-1"></i>
                  ${isOwnerMode ? 'Panel de Negocio: Modificar Reserva' : 'Reprogramar mi Turno'}
                </span>
                <h3 class="text-xl font-black mt-0.5">${biz.name}</h3>
                <span class="text-xs text-blue-100 font-mono">CÓDIGO RESERVA: #${appointment.id.toUpperCase()}</span>
              </div>
              <button id="close-reschedule-modal-btn" class="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors">
                <i class="fas fa-times"></i>
              </button>
            </div>

            <!-- Body -->
            <form id="reschedule-form" class="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <!-- Info Actual -->
              <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-xs">
                <div>
                  <span class="text-[10px] uppercase font-bold text-slate-400 block">Horario Registrado</span>
                  <span class="font-bold text-slate-700"><i class="far fa-calendar mr-1 text-blue-600"></i>${this.formatDateDMY(appointment.date)}</span>
                  <span class="font-bold text-slate-700 ml-2"><i class="far fa-clock mr-1 text-blue-600"></i>${this.formatTime12h(appointment.time)}</span>
                </div>
                <div class="text-right">
                  <span class="text-[10px] uppercase font-bold text-slate-400 block">Estado</span>
                  <span class="badge-status badge-status-${appointment.status}">${appointment.status === 'confirmed' ? 'Confirmada' : appointment.status === 'pending' ? 'Pendiente' : appointment.status === 'completed' ? 'Completada' : 'Cancelada'}</span>
                </div>
              </div>

              <!-- Selector de Servicio -->
              ${biz.services && biz.services.length > 0 ? `
                <div>
                  <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Servicio
                  </label>
                  <select id="reschedule-service-select" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none">
                    ${biz.services.map(s => `
                      <option value="${s.id}" ${s.id === selectedServiceId ? 'selected' : ''}>
                        ${s.name} - ${this.formatColones(s.price)} (${s.duration} min)
                      </option>
                    `).join('')}
                  </select>
                </div>
              ` : ''}

              <!-- 1. Nueva Fecha -->
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  1. Seleccionar Fecha
                </label>
                <input 
                  type="date" 
                  id="reschedule-date-input" 
                  value="${selectedDate}" 
                  min="${this.getTodayDateString()}" 
                  required
                  class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <!-- 2. Horarios Disponibles -->
              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    2. Seleccionar Horario (${availability.slots ? availability.slots.length : 0} disponibles)
                  </label>
                  ${selectedTime ? `
                    <span class="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                      Seleccionado: ${this.formatTime12h(selectedTime)}
                    </span>
                  ` : ''}
                </div>

                ${availability.isClosed ? `
                  <div class="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-2">
                    <i class="fas fa-calendar-times text-base"></i>
                    <span>${availability.reason}</span>
                  </div>
                ` : availability.slots.length === 0 ? `
                  <div class="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs flex items-center gap-2">
                    <i class="fas fa-info-circle text-base"></i>
                    <span>No hay horarios disponibles en esta fecha. Por favor elige otro día.</span>
                  </div>
                ` : `
                  <div class="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1 bg-slate-50 rounded-2xl border border-slate-200">
                    ${availability.slots.map(slot => `
                      <button 
                        type="button" 
                        class="reschedule-slot-btn py-2 px-2 text-xs font-bold rounded-xl border transition-all ${selectedTime === slot ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-blue-50'}"
                        data-slot="${slot}"
                      >
                        ${this.formatTime12h(slot)}
                      </button>
                    `).join('')}
                  </div>
                `}
              </div>

              <!-- Opciones adicionales para Dueño de Negocio -->
              ${isOwnerMode ? `
                <div class="pt-3 border-t border-slate-200 space-y-3">
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs font-bold text-slate-700 mb-1">Nombre del Cliente</label>
                      <input type="text" id="reschedule-client-name" value="${appointment.clientName || ''}" required class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium">
                    </div>
                    <div>
                      <label class="block text-xs font-bold text-slate-700 mb-1">Teléfono / WhatsApp</label>
                      <input type="tel" id="reschedule-client-phone" value="${appointment.clientPhone || ''}" required class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium">
                    </div>
                  </div>

                  <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1">Estado de la Reserva</label>
                    <select id="reschedule-status-select" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800">
                      <option value="confirmed" ${appointment.status === 'confirmed' ? 'selected' : ''}>✅ Confirmada / Aceptada</option>
                      <option value="pending" ${appointment.status === 'pending' ? 'selected' : ''}>⏳ Pendiente de Confirmación</option>
                      <option value="completed" ${appointment.status === 'completed' ? 'selected' : ''}>🎉 Completada / Atendida</option>
                      <option value="cancelled" ${appointment.status === 'cancelled' ? 'selected' : ''}>❌ Cancelada</option>
                    </select>
                  </div>
                </div>
              ` : ''}

              <!-- Notas adicionales -->
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">
                  Notas o Solicitudes Especiales
                </label>
                <textarea id="reschedule-notes-input" rows="2" placeholder="Ej: Confirmar si llego 5 minutos tarde..." class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500">${appointment.notes || ''}</textarea>
              </div>

              <!-- Botones de Acción -->
              <div class="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button type="button" id="cancel-reschedule-btn" class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors">
                  Cerrar
                </button>
                <button type="submit" id="save-reschedule-btn" class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5">
                  <i class="fas fa-check-circle"></i> Guardar y Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      `;

      // Eventos del Modal
      document.getElementById('close-reschedule-modal-btn')?.addEventListener('click', () => {
        modalContainer.innerHTML = '';
      });
      document.getElementById('cancel-reschedule-btn')?.addEventListener('click', () => {
        modalContainer.innerHTML = '';
      });

      document.getElementById('reschedule-service-select')?.addEventListener('change', (e) => {
        selectedServiceId = e.target.value;
        renderModalContent();
      });

      document.getElementById('reschedule-date-input')?.addEventListener('change', (e) => {
        selectedDate = e.target.value;
        selectedTime = null;
        renderModalContent();
      });

      document.querySelectorAll('.reschedule-slot-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          selectedTime = btn.getAttribute('data-slot');
          renderModalContent();
        });
      });

      document.getElementById('reschedule-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedTime) {
          this.showToast('Por favor selecciona un horario disponible para la reserva.', 'error');
          return;
        }

        const srv = biz.services?.find(s => s.id === selectedServiceId) || currentService;
        const notes = document.getElementById('reschedule-notes-input')?.value.trim() || '';

        const updatedData = {
          ...appointment,
          serviceId: srv.id,
          serviceName: srv.name,
          servicePrice: srv.price,
          serviceDuration: srv.duration,
          date: selectedDate,
          time: selectedTime,
          notes
        };

        if (isOwnerMode) {
          updatedData.clientName = document.getElementById('reschedule-client-name')?.value.trim() || appointment.clientName;
          updatedData.clientPhone = document.getElementById('reschedule-client-phone')?.value.trim() || appointment.clientPhone;
          updatedData.status = document.getElementById('reschedule-status-select')?.value || appointment.status;
        } else {
          if (updatedData.status === 'cancelled') {
            updatedData.status = 'confirmed';
          }
        }

        await storage.updateAppointment(appointment.id, updatedData);
        this.showToast('¡Reserva modificada y reprogramada con éxito!', 'success');
        modalContainer.innerHTML = '';
        this.renderCurrentView();
      });
    };

    renderModalContent();
  }

  // ==========================================
  // VISTA 4: MIS RESERVAS (HISTORIAL DE CLIENTE)
  // ==========================================
  async renderClientBookingsView(container) {
    const clientUser = storage.getClientUser();
    if (!clientUser) {
      this.renderAuthModal({ mode: 'login', role: 'client' });
      this.navigateTo('directory');
      return;
    }

    const allAppointments = await storage.getClientAppointmentsAsync(clientUser.phone, clientUser.email);
    const filter = this.clientAppointmentFilter || 'all';

    let appointments = allAppointments;
    if (filter === 'active') {
      appointments = allAppointments.filter(a => a.status === 'pending' || a.status === 'confirmed');
    } else if (filter === 'completed') {
      appointments = allAppointments.filter(a => a.status === 'completed');
    } else if (filter === 'cancelled') {
      appointments = allAppointments.filter(a => a.status === 'cancelled');
    }

    const activeCount = allAppointments.filter(a => a.status === 'pending' || a.status === 'confirmed').length;
    const completedCount = allAppointments.filter(a => a.status === 'completed').length;
    const cancelledCount = allAppointments.filter(a => a.status === 'cancelled').length;

    container.innerHTML = `
      <div class="animate-fade-in pb-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div class="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span class="text-xs font-bold text-blue-600 uppercase tracking-wider">Portal de Cliente</span>
            <h1 class="text-2xl font-black text-slate-900 mt-1">Mis Reservas</h1>
            <p class="text-xs text-slate-500 mt-1">Hola <strong>${clientUser.name}</strong> • ${clientUser.phone} ${clientUser.email ? `• ${clientUser.email}` : ''}</p>
          </div>
          <div class="flex items-center gap-2">
            <button id="go-explore-top-btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20">
              <i class="fas fa-plus mr-1"></i> Nueva Reserva
            </button>
            <button id="client-logout-view-btn" class="px-4 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-700 rounded-xl text-xs font-bold transition-all">
              <i class="fas fa-sign-out-alt mr-1"></i> Salir
            </button>
          </div>
        </div>

        <!-- Filtros de Estado -->
        <div class="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          <button class="client-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${filter === 'all' ? 'bg-slate-900 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}" data-filter="all">
            Todas (${allAppointments.length})
          </button>
          <button class="client-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${filter === 'active' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}" data-filter="active">
            Activas (${activeCount})
          </button>
          <button class="client-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${filter === 'completed' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}" data-filter="completed">
            Completadas (${completedCount})
          </button>
          <button class="client-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${filter === 'cancelled' ? 'bg-rose-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}" data-filter="cancelled">
            Canceladas (${cancelledCount})
          </button>
        </div>

        ${appointments.length === 0 ? `
          <div class="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8 shadow-xs">
            <div class="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">
              <i class="far fa-calendar-alt"></i>
            </div>
            <h3 class="text-lg font-bold text-slate-800">No hay reservas en esta categoría</h3>
            <p class="text-xs text-slate-500 mt-1">Explora los comercios disponibles y agenda tu primer turno.</p>
            <button id="go-explore-btn" class="mt-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20">
              Explorar Comercios
            </button>
          </div>
        ` : `
          <div class="space-y-4">
            ${appointments.map(apt => `
              <div class="p-5 sm:p-6 bg-white rounded-3xl border border-slate-200 shadow-xs flex flex-col gap-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div class="flex items-center gap-2 mb-1 flex-wrap">
                      <span class="font-black text-lg text-slate-900">${apt.businessName || 'Comercio'}</span>
                      <span class="badge-status badge-status-${apt.status}">
                        ${apt.status === 'confirmed' ? 'Confirmada' : apt.status === 'pending' ? 'Pendiente' : apt.status === 'completed' ? 'Completada' : 'Cancelada'}
                      </span>
                      ${apt.whatsappOptIn !== false ? `
                        <span class="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <i class="fab fa-whatsapp text-emerald-600"></i> WhatsApp
                        </span>
                      ` : ''}
                      ${apt.staffName ? `
                        <span class="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                          <i class="fas fa-user-tag text-blue-500"></i> ${apt.staffName}
                        </span>
                      ` : ''}
                    </div>
                    <h4 class="font-bold text-sm text-blue-600">${apt.serviceName}</h4>
                    <div class="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                      <span><i class="far fa-calendar mr-1 text-slate-400"></i><strong>${this.formatDateDMY(apt.date)}</strong></span>
                      <span><i class="far fa-clock mr-1 text-slate-400"></i><strong>${this.formatTime12h(apt.time)}</strong> (${apt.serviceDuration} min)</span>
                      ${apt.notes ? `<span class="text-slate-400 italic">"${apt.notes}"</span>` : ''}
                    </div>
                  </div>

                  <div class="text-right flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                    <span class="text-xl font-black text-slate-900">${this.formatColones(apt.servicePrice)}</span>
                    <span class="text-[10px] text-slate-400 font-mono mt-0.5">CÓDIGO: #${apt.id.toUpperCase()}</span>
                  </div>
                </div>

                <!-- Botones de Acción para el Cliente -->
                <div class="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">
                  ${(apt.status === 'pending' || apt.status === 'confirmed') ? `
                    <button class="client-reschedule-btn px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5" data-apt-id="${apt.id}">
                      <i class="fas fa-calendar-alt"></i> Reprogramar Turno
                    </button>
                    <button class="client-cancel-btn px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5" data-apt-id="${apt.id}">
                      <i class="fas fa-times-circle"></i> Cancelar Reserva
                    </button>
                  ` : ''}
                  ${apt.status === 'cancelled' ? `
                    <button class="client-reschedule-btn px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center gap-1.5" data-apt-id="${apt.id}">
                      <i class="fas fa-redo"></i> Reprogramar Reserva
                    </button>
                  ` : ''}
                  ${apt.status === 'completed' ? `
                    <button class="client-rate-btn px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-xs" data-apt-id="${apt.id}">
                      <i class="fas fa-star text-amber-500"></i> Calificar Atención
                    </button>
                    <span class="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1">
                      <i class="fas fa-check-circle"></i> Atendida
                    </span>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    document.getElementById('go-explore-top-btn')?.addEventListener('click', () => this.navigateTo('directory'));
    document.getElementById('go-explore-btn')?.addEventListener('click', () => this.navigateTo('directory'));
    
    document.getElementById('client-logout-view-btn')?.addEventListener('click', () => {
      storage.logoutClient();
      this.showToast('Sesión cerrada.', 'info');
      this.renderHeader();
      this.navigateTo('directory');
    });

    document.querySelectorAll('.client-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.clientAppointmentFilter = btn.getAttribute('data-filter');
        this.renderClientBookingsView(container);
      });
    });

    document.querySelectorAll('.client-rate-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const aptId = btn.getAttribute('data-apt-id');
        this.navigateTo('review-booking', { appointmentId: aptId });
      });
    });

    document.querySelectorAll('.client-reschedule-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const aptId = btn.getAttribute('data-apt-id');
        const apt = allAppointments.find(a => a.id === aptId);
        if (apt) {
          this.renderRescheduleModal(apt, false);
        }
      });
    });

    document.querySelectorAll('.client-cancel-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const aptId = btn.getAttribute('data-apt-id');
        if (confirm('¿Estás seguro de que deseas cancelar esta reserva?')) {
          await storage.updateAppointmentStatus(aptId, 'cancelled');
          this.showToast('Reserva cancelada correctamente.', 'info');
          this.renderClientBookingsView(container);
        }
      });
    });
  }

  // ==========================================
  // VISTA 3: PANEL DE DUEÑO DE NEGOCIO (DASHBOARD)
  // ==========================================
  renderOwnerDashboardView(container) {
    const bizUser = storage.getBusinessUser();
    if (!bizUser) {
      this.renderBusinessAuthModal();
      this.navigateTo('directory');
      return;
    }

    const currentBiz = storage.getBusinessById(bizUser.businessId) || storage.getBusinesses()[0];
    if (!currentBiz) {
      this.navigateTo('directory');
      return;
    }

    const appointments = storage.getAppointmentsByBusiness(currentBiz.id);
    const todayStr = this.getTodayDateString();
    const todayAppointments = appointments.filter(a => a.date === todayStr && a.status !== 'cancelled');
    const estimatedRevenue = appointments.filter(a => a.status === 'confirmed' || a.status === 'completed').reduce((sum, a) => sum + (a.servicePrice || 0), 0);

    // Métricas del Plan de Suscripción ($6, $15, $25)
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthAppointments = appointments.filter(a => (a.date || '').startsWith(currentMonth));
    const currentPlanId = currentBiz.plan || 'basic';
    const planConfig = storage.getPlanById(currentPlanId) || { id: 'basic', name: 'Plan Básico', priceUsd: 6, bookingLimit: 150 };
    const monthlyLimit = (currentBiz.monthlyBookingLimit !== undefined && currentBiz.monthlyBookingLimit !== null) ? currentBiz.monthlyBookingLimit : planConfig.bookingLimit;
    const isUnlimited = monthlyLimit === null || monthlyLimit === undefined || monthlyLimit < 0;
    const usageCount = monthAppointments.length;
    const percentUsed = isUnlimited ? 0 : Math.min(100, Math.round((usageCount / (monthlyLimit || 1)) * 100));

    container.innerHTML = `
      <div class="animate-fade-in pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <!-- Top Bar -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs mb-6">
          <div class="flex items-center gap-4">
            <img src="${currentBiz.image || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80'}" alt="${currentBiz.name}" class="w-16 h-16 rounded-2xl object-cover border border-slate-200 shadow-sm">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-blue-600 uppercase tracking-wider">Panel Administrador</span>
                ${currentBiz.isDemo ? `
                  <span class="bg-purple-100 text-purple-700 text-[10px] font-extrabold px-2 py-0.5 rounded-md">Comercio de Muestra</span>
                ` : `
                  <span class="bg-emerald-100 text-emerald-700 text-[10px] font-extrabold px-2 py-0.5 rounded-md">Comercio Verificado</span>
                `}
              </div>
              <h1 class="text-xl font-extrabold text-slate-900">${currentBiz.name}</h1>
              <span class="text-xs text-slate-500">Sesión iniciada como: <strong>${bizUser.name || bizUser.email}</strong></span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button id="dash-logout-btn" class="px-4 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer">
              <i class="fas fa-sign-out-alt mr-1"></i> Salir del Panel
            </button>
          </div>
        </div>

        <!-- Banner de Activación SINPE Pendiente (Si aplica) -->
        ${(currentBiz.subscriptionStatus === 'pending_sinpe' || currentBiz.subscription_status === 'pending_sinpe') ? `
          <div class="bg-amber-500/10 border-2 border-amber-400 p-5 rounded-3xl mb-6 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in shadow-md">
            <div class="flex items-center gap-3.5">
              <div class="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center text-xl flex-shrink-0 shadow-sm">
                <i class="fas fa-clock"></i>
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-black uppercase tracking-wider bg-amber-400 text-slate-950 px-2 py-0.5 rounded-md">Activación SINPE Pendiente</span>
                  <span class="text-xs font-bold text-amber-900">${planConfig.name}</span>
                </div>
                <p class="text-xs text-amber-900 mt-1">
                  Tu comercio está pendiente de verificación SINPE. Transfiere <strong>~${this.formatColones(planConfig.priceCrc || (planConfig.priceUsd * 530))} CRC</strong> al <strong>7143-3852</strong> (Juan Jose Jiménez) y envía el comprobante por WhatsApp.
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2 w-full sm:w-auto shrink-0">
              <button id="dash-view-sinpe-instructions-btn" class="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer">
                <i class="fab fa-whatsapp text-sm"></i>
                <span>Ver Datos SINPE & WhatsApp</span>
              </button>
            </div>
          </div>
        ` : ''}

        <!-- Banner de Suscripción y Cuota Mensual -->
        <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 rounded-3xl border border-indigo-500/30 shadow-lg mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div class="space-y-1.5 max-w-xl">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="px-3 py-1 rounded-full ${currentPlanId === 'unlimited' ? 'bg-purple-500 text-white' : currentPlanId === 'pro' ? 'bg-amber-400 text-slate-950' : 'bg-blue-500 text-white'} text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5">
                <i class="fas ${currentPlanId === 'unlimited' ? 'fa-infinity' : currentPlanId === 'pro' ? 'fa-crown' : 'fa-check'}"></i>
                ${planConfig.name}
              </span>
              <span class="text-xs text-amber-300 font-extrabold bg-white/10 px-2.5 py-0.5 rounded-lg border border-white/10">
                $${planConfig.priceUsd} USD / mes (~${this.formatColones(planConfig.priceCrc || (planConfig.priceUsd * 530))})
              </span>
            </div>
            <h3 class="text-lg font-black text-white">Consumo de Reservas del Mes (${new Date().toLocaleString('es-CR', { month: 'long', year: 'numeric' })})</h3>
            <p class="text-xs text-slate-300">
              ${isUnlimited 
                ? `🚀 Tu comercio cuenta con el <strong>Plan Ilimitado</strong>. Puedes recibir todas las reservas que desees sin restricciones ni comisiones.`
                : `Has recibido <strong>${usageCount}</strong> de <strong>${monthlyLimit}</strong> reservas mensuales permitidas este mes.`}
            </p>
          </div>

          <div class="w-full md:w-80 bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-xs space-y-3">
            ${!isUnlimited ? `
              <div class="space-y-1.5">
                <div class="flex justify-between text-xs font-bold">
                  <span class="text-slate-300">Progreso mensual</span>
                  <span class="${percentUsed > 90 ? 'text-rose-400' : percentUsed > 75 ? 'text-amber-400' : 'text-emerald-400'}">${usageCount} / ${monthlyLimit}</span>
                </div>
                <div class="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
                  <div class="h-full rounded-full transition-all duration-500 ${percentUsed > 90 ? 'bg-rose-500' : percentUsed > 75 ? 'bg-amber-400' : 'bg-emerald-500'}" style="width: ${percentUsed}%"></div>
                </div>
                <div class="flex justify-between text-[11px] text-slate-400 font-medium">
                  <span>${percentUsed}% ocupado</span>
                  <span>${monthlyLimit - usageCount > 0 ? `${monthlyLimit - usageCount} restantes` : 'Cupo alcanzado'}</span>
                </div>
              </div>
            ` : `
              <div class="text-center py-1">
                <div class="inline-flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <i class="fas fa-check-double"></i>
                  <span>Sin límite de reservas</span>
                </div>
                <p class="text-[11px] text-slate-400 mt-0.5">${usageCount} reservas recibidas este mes</p>
              </div>
            `}

            <button id="dash-change-plan-btn" class="w-full py-2 px-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 cursor-pointer">
              <i class="fas fa-arrow-up-right-from-square text-xs"></i>
              <span>Cambiar o Mejorar Plan</span>
            </button>
          </div>
        </div>

        <!-- Metric Stat Cards -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div class="flex items-center justify-between text-slate-500 mb-2">
              <span class="text-xs font-semibold uppercase">Reservas Hoy</span>
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
            <span class="text-[11px] text-emerald-600 block mt-1">reservas confirmadas</span>
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
          <button class="dash-tab-btn px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${this.activeDashboardTab === 'blocked-slots' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-100'}" data-tab="blocked-slots">
            <i class="fas fa-calendar-times mr-1.5 text-rose-400"></i> Bloqueos y Horas
          </button>
          <button class="dash-tab-btn px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${this.activeDashboardTab === 'team' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-100'}" data-tab="team">
            <i class="fas fa-users-cog mr-1.5 text-indigo-500"></i> Equipo y Especialistas
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

    document.getElementById('dash-logout-btn')?.addEventListener('click', () => {
      storage.logoutBusiness();
      this.showToast('Sesión de negocio cerrada.', 'info');
      this.renderHeader();
      this.navigateTo('directory');
    });

    document.getElementById('dash-change-plan-btn')?.addEventListener('click', () => {
      this.renderPlansModal({ businessId: currentBiz.id, currentPlanId });
    });

    document.getElementById('dash-view-sinpe-instructions-btn')?.addEventListener('click', () => {
      this.renderSinpePaymentModal({ businessId: currentBiz.id, planId: currentBiz.plan || 'basic' });
    });

    document.querySelectorAll('.dash-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeDashboardTab = btn.getAttribute('data-tab');
        this.renderCurrentView();
      });
    });

    this.setupDashboardTabEvents(currentBiz);
  }

  // --- SUB-CONTENIDOS DEL DASHBOARD ---
  renderDashboardTabContent(currentBiz, appointments) {
    if (this.activeDashboardTab === 'appointments') {
      const filter = this.ownerAppointmentFilter || 'all';
      const staffFilter = this.ownerStaffFilter || 'all';
      const businessStaff = storage.getBusinessStaffSync(currentBiz.id) || [];

      let filteredAppointments = appointments;

      // Filtro por Estado
      if (filter === 'pending') {
        filteredAppointments = appointments.filter(a => a.status === 'pending');
      } else if (filter === 'confirmed') {
        filteredAppointments = appointments.filter(a => a.status === 'confirmed');
      } else if (filter === 'completed') {
        filteredAppointments = appointments.filter(a => a.status === 'completed');
      } else if (filter === 'cancelled') {
        filteredAppointments = appointments.filter(a => a.status === 'cancelled');
      }

      // Filtro por Especialista
      if (staffFilter === 'unassigned') {
        filteredAppointments = filteredAppointments.filter(a => !a.staffId);
      } else if (staffFilter && staffFilter !== 'all') {
        filteredAppointments = filteredAppointments.filter(a => a.staffId === staffFilter);
      }

      const pendingCount = appointments.filter(a => a.status === 'pending').length;
      const confirmedCount = appointments.filter(a => a.status === 'confirmed').length;
      const completedCount = appointments.filter(a => a.status === 'completed').length;
      const cancelledCount = appointments.filter(a => a.status === 'cancelled').length;

      const isAutoConfirm = currentBiz.autoConfirmAppointments !== false;

      return `
        <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 class="text-lg font-bold text-slate-900">Agenda y Reservas</h2>
              <p class="text-xs text-slate-500">Gestiona, acepta, reprograma, cancela y actualiza reservas en tiempo real.</p>
            </div>

            <div class="flex items-center gap-2 flex-wrap">
              ${currentBiz.plan === 'unlimited' ? `
                <button id="dash-export-csv-btn" class="px-3.5 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer">
                  <i class="fas fa-file-csv text-purple-600"></i> Exportar Clientes (CSV)
                </button>
              ` : `
                <button id="dash-upgrade-prompt-btn" class="px-3.5 py-2.5 bg-slate-50 hover:bg-purple-50 text-slate-600 hover:text-purple-800 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer" title="Exportar base de clientes está incluido en el Plan Ilimitado">
                  <i class="fas fa-crown text-amber-500"></i> Base de Clientes (Plan ∞)
                </button>
              `}
              <button id="add-manual-appointment-btn" class="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-blue-500/20 cursor-pointer">
                <i class="fas fa-plus-circle"></i> Nueva Reserva Manual
              </button>
            </div>
          </div>

          <!-- Banner Informativo con Switch de Autoconfirmación de Reservas -->
          <div class="mb-6 p-4 sm:p-5 rounded-2xl border transition-all ${isAutoConfirm ? 'bg-emerald-50/70 border-emerald-200/80 shadow-xs' : 'bg-amber-50/80 border-amber-200/90 shadow-xs'}">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div class="space-y-1.5">
                <div class="flex items-center gap-2 flex-wrap">
                  <div class="w-7 h-7 rounded-xl flex items-center justify-center text-xs ${isAutoConfirm ? 'bg-emerald-600 text-white shadow-xs' : 'bg-amber-500 text-slate-950 shadow-xs'}">
                    <i class="fas ${isAutoConfirm ? 'fa-magic' : 'fa-hand-paper'}"></i>
                  </div>
                  <h3 class="text-sm font-black text-slate-900">Autoconfirmación de Reservas</h3>
                  <span class="text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full ${isAutoConfirm ? 'bg-emerald-200/70 text-emerald-900 border border-emerald-300/60' : 'bg-amber-200/80 text-amber-950 border border-amber-300/70'}">
                    ${isAutoConfirm ? '⚡ Modo Automático Activo' : '✋ Modo Manual (Aprobación Requerida)'}
                  </span>
                </div>
                <p class="text-xs text-slate-700 leading-relaxed max-w-3xl">
                  ${isAutoConfirm ? `
                    <strong>¿Para qué sirve?</strong> Al estar <strong>activa</strong>, las reservas generadas por tus clientes en la página se confirman inmediatamente y el sistema les envía en el acto la confirmación por <strong>correo electrónico y WhatsApp</strong>.
                  ` : `
                    <strong>¿Para qué sirve?</strong> Al estar <strong>inactiva</strong>, cada nueva reserva entrará en estado <strong>Pendiente</strong>. El cliente verá un aviso en la página indicándole que <em>en unos minutos recibirá la confirmación</em>. El correo y WhatsApp se enviarán únicamente hasta que presiones <strong>"Aceptar"</strong> en la reserva.
                  `}
                </p>
              </div>

              <!-- Switch Toggle -->
              <div class="flex items-center gap-3 self-start sm:self-center bg-white/80 backdrop-blur-xs px-3.5 py-2 rounded-2xl border border-slate-200/80 shadow-2xs flex-shrink-0">
                <div class="text-right">
                  <span class="block text-xs font-black ${isAutoConfirm ? 'text-emerald-700' : 'text-slate-600'}">
                    ${isAutoConfirm ? 'Autoconfirmar' : 'Confirmación Manual'}
                  </span>
                  <span class="block text-[10px] text-slate-400">
                    ${isAutoConfirm ? 'Instantáneo' : 'Requiere Aprobación'}
                  </span>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" id="toggle-auto-confirm-switch" class="sr-only peer" ${isAutoConfirm ? 'checked' : ''}>
                  <div class="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>
          </div>

          <!-- Filtros de Estado, Especialista y Botón de Bloqueo Rápido -->
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-6">
            <div class="flex items-center gap-2 overflow-x-auto pb-1 flex-wrap">
              <button class="owner-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${filter === 'all' ? 'bg-slate-900 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}" data-filter="all">
                Todas (${appointments.length})
              </button>
              <button class="owner-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${filter === 'pending' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}" data-filter="pending">
                ⏳ Pendientes (${pendingCount})
              </button>
              <button class="owner-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${filter === 'confirmed' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}" data-filter="confirmed">
                ✅ Confirmadas (${confirmedCount})
              </button>
              <button class="owner-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${filter === 'completed' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}" data-filter="completed">
                🎉 Completadas (${completedCount})
              </button>
              <button class="owner-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${filter === 'cancelled' ? 'bg-rose-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}" data-filter="cancelled">
                ❌ Canceladas (${cancelledCount})
              </button>
            </div>

            <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
              ${businessStaff.length > 0 ? `
                <div class="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
                  <i class="fas fa-user-tag text-slate-400 text-xs"></i>
                  <select id="owner-staff-filter-select" class="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer">
                    <option value="all" ${staffFilter === 'all' ? 'selected' : ''}>Todos los Especialistas</option>
                    <option value="unassigned" ${staffFilter === 'unassigned' ? 'selected' : ''}>Sin Asignar / General</option>
                    ${businessStaff.map(st => `
                      <option value="${st.id}" ${staffFilter === st.id ? 'selected' : ''}>${st.name} (${st.roleTitle || 'Especialista'})</option>
                    `).join('')}
                  </select>
                </div>
              ` : ''}

              <button id="quick-manage-slots-btn" class="px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center gap-1.5 shadow-sm shadow-blue-500/20 flex-shrink-0 cursor-pointer">
                <i class="fas fa-calendar-times"></i> Bloquear / Liberar Horas
              </button>
            </div>
          </div>

          ${filteredAppointments.length === 0 ? `
            <div class="text-center py-12 text-slate-400">
              <i class="far fa-calendar-times text-4xl mb-2"></i>
              <p class="text-sm font-semibold">No hay reservas en esta categoría o filtro de especialista.</p>
            </div>
          ` : `
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs text-slate-700">
                <thead class="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th class="py-3 px-4">Fecha / Hora</th>
                    <th class="py-3 px-4">Cliente</th>
                    <th class="py-3 px-4">Especialista</th>
                    <th class="py-3 px-4">Servicio</th>
                    <th class="py-3 px-4">Monto</th>
                    <th class="py-3 px-4">Estado</th>
                    <th class="py-3 px-4 text-right">Acciones de Gestión</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  ${filteredAppointments.map(apt => `
                    <tr class="hover:bg-slate-50/80 transition-colors">
                      <td class="py-3.5 px-4 font-bold text-slate-900">
                        <div>${this.formatDateDMY(apt.date)}</div>
                        <div class="text-blue-600 text-[11px] font-mono">${this.formatTime12h(apt.time)} (${apt.serviceDuration}m)</div>
                      </td>
                      <td class="py-3.5 px-4">
                        <div class="font-bold text-slate-800">${apt.clientName}</div>
                        <div class="text-slate-400 text-[11px]">${apt.clientPhone}</div>
                      </td>
                      <td class="py-3.5 px-4">
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 text-[11px] font-bold">
                          <i class="fas fa-user-tag text-blue-500 text-[10px]"></i>
                          <span>${apt.staffName || 'Sin asignar / General'}</span>
                        </span>
                      </td>
                      <td class="py-3.5 px-4 font-medium text-slate-700">
                        <div class="font-semibold text-slate-800">${apt.serviceName}</div>
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
                        <!-- Aceptar / Confirmar -->
                        ${(apt.status === 'pending' || apt.status === 'cancelled') ? `
                          <button class="status-change-btn px-2.5 py-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer" data-apt-id="${apt.id}" data-status="confirmed" title="Aceptar y confirmar reserva">
                            <i class="fas fa-check-circle"></i> Aceptar
                          </button>
                        ` : ''}

                        <!-- Marcar como Completada -->
                        ${(apt.status === 'confirmed' || apt.status === 'pending') ? `
                          <button class="status-change-btn px-2.5 py-1.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer" data-apt-id="${apt.id}" data-status="completed" title="Marcar como atendida / completada">
                            <i class="fas fa-clipboard-check"></i> Completar
                          </button>
                        ` : ''}

                        <!-- Reprogramar / Modificar -->
                        <button class="edit-appointment-btn px-2.5 py-1.5 text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer" data-apt-id="${apt.id}" title="Modificar fecha, hora, servicio o datos">
                          <i class="fas fa-calendar-alt"></i> Modificar
                        </button>

                        <!-- Cancelar -->
                        ${apt.status !== 'cancelled' ? `
                          <button class="status-change-btn px-2.5 py-1.5 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer" data-apt-id="${apt.id}" data-status="cancelled" title="Cancelar reserva">
                            <i class="fas fa-ban"></i> Cancelar
                          </button>
                        ` : ''}

                        <!-- Eliminar -->
                        <button class="delete-apt-btn p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors inline-flex items-center cursor-pointer" data-apt-id="${apt.id}" title="Eliminar registro">
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

    if (this.activeDashboardTab === 'team') {
      return this.renderTeamTabContent(currentBiz);
    }

    if (this.activeDashboardTab === 'blocked-slots') {
      return this.renderBlockedSlotsTabContent(currentBiz, appointments);
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
            <div class="flex items-center gap-2">
              <button id="quick-manage-slots-from-services-btn" class="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer">
                <i class="fas fa-calendar-times"></i> Gestionar Horas
              </button>
              <button id="add-new-service-btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer">
                <i class="fas fa-plus"></i> Agregar Servicio
              </button>
            </div>
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
                    <i class="fas fa-ruler-combined mr-1"></i> Medida: 1200 x 450 px (16:6)
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
                    <i class="fas fa-ruler-combined mr-1"></i> Medida: 800 x 800 px (1:1)
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

            <!-- Redes Sociales y Enlaces Web -->
            <div class="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <div class="flex items-center justify-between">
                <h3 class="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <i class="fas fa-share-alt text-blue-600"></i> Redes Sociales & Sitio Web
                </h3>
                <span class="text-[11px] text-slate-400 font-medium">Visibles para tus clientes</span>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-pink-600 text-sm">
                    <i class="fab fa-instagram"></i>
                  </div>
                  <input type="text" id="edit-biz-instagram" value="${currentBiz.socialLinks?.instagram || currentBiz.social_links?.instagram || ''}" placeholder="Instagram (@minegocio o URL)" class="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-pink-400 focus:outline-none">
                </div>

                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-blue-600 text-sm">
                    <i class="fab fa-facebook"></i>
                  </div>
                  <input type="text" id="edit-biz-facebook" value="${currentBiz.socialLinks?.facebook || currentBiz.social_links?.facebook || ''}" placeholder="Facebook (usuario o enlace)" class="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-400 focus:outline-none">
                </div>

                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-900 text-sm">
                    <i class="fab fa-tiktok"></i>
                  </div>
                  <input type="text" id="edit-biz-tiktok" value="${currentBiz.socialLinks?.tiktok || currentBiz.social_links?.tiktok || ''}" placeholder="TikTok (@minegocio)" class="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-slate-400 focus:outline-none">
                </div>

                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-600 text-sm">
                    <i class="fas fa-globe"></i>
                  </div>
                  <input type="text" id="edit-biz-website" value="${currentBiz.socialLinks?.website || currentBiz.social_links?.website || ''}" placeholder="Sitio Web / Menú Digital (https://...)" class="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-400 focus:outline-none">
                </div>
              </div>
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
      const sch = currentBiz.schedule || { days: [1, 2, 3, 4, 5, 6], openTime: '08:00', closeTime: '18:00', slotDuration: 30 };
      const currentSlotDuration = sch.slotDuration === 15 ? 15 : 30;
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
          <p class="text-xs text-slate-500 mb-6">Define los días y franjas horarias en las que tu negocio puede recibir reservas.</p>

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

            <!-- Intervalo de Franjas Horarias (15 min vs 30 min) -->
            <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <label class="block font-bold text-slate-800 text-xs uppercase tracking-wider">Intervalo de Turnos / Horarios</label>
                  <p class="text-[11px] text-slate-500">Elige la duración de cada bloque horario para las reservas públicas y el bloqueo de agenda.</p>
                </div>
                <div class="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-sm flex-shrink-0">
                  <i class="fas fa-stopwatch"></i>
                </div>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <label class="flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${currentSlotDuration === 15 ? 'bg-blue-50/90 border-blue-500 text-blue-950 font-bold ring-2 ring-blue-500/20 shadow-xs' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}">
                  <input type="radio" name="slot_duration" value="15" ${currentSlotDuration === 15 ? 'checked' : ''} class="text-blue-600 focus:ring-blue-500 w-4 h-4">
                  <div>
                    <span class="block text-xs font-bold text-slate-900">Cada 15 Minutos</span>
                    <span class="block text-[10px] text-slate-500">Ej: 8:00, 8:15, 8:30, 8:45...</span>
                  </div>
                </label>
                <label class="flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${currentSlotDuration === 30 ? 'bg-blue-50/90 border-blue-500 text-blue-950 font-bold ring-2 ring-blue-500/20 shadow-xs' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}">
                  <input type="radio" name="slot_duration" value="30" ${currentSlotDuration === 30 ? 'checked' : ''} class="text-blue-600 focus:ring-blue-500 w-4 h-4">
                  <div>
                    <span class="block text-xs font-bold text-slate-900">Cada 30 Minutos (Estándar)</span>
                    <span class="block text-[10px] text-slate-500">Ej: 8:00, 8:30, 9:00, 9:30...</span>
                  </div>
                </label>
              </div>
            </div>

            <!-- Autoconfirmación de Reservas en Horarios -->
            <div class="p-5 rounded-2xl border transition-all ${currentBiz.autoConfirmAppointments !== false ? 'bg-emerald-50/70 border-emerald-200/80 shadow-xs' : 'bg-amber-50/80 border-amber-200/90 shadow-xs'} space-y-3">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="space-y-1">
                  <div class="flex items-center gap-2">
                    <i class="fas ${currentBiz.autoConfirmAppointments !== false ? 'fa-magic text-emerald-600' : 'fa-hand-paper text-amber-600'} text-base"></i>
                    <span class="font-bold text-slate-900 text-sm">Autoconfirmación de Reservas</span>
                    <span class="text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full ${currentBiz.autoConfirmAppointments !== false ? 'bg-emerald-200/70 text-emerald-900' : 'bg-amber-200/80 text-amber-950'}">
                      ${currentBiz.autoConfirmAppointments !== false ? '⚡ Automático' : '✋ Manual'}
                    </span>
                  </div>
                  <p class="text-xs text-slate-600 leading-relaxed">
                    ${currentBiz.autoConfirmAppointments !== false
                      ? 'Las reservas se confirman inmediatamente y se envía WhatsApp y correo al cliente al agendar.'
                      : 'Las reservas entran en estado Pendiente y requieren tu confirmación antes de enviar WhatsApp y correo.'}
                  </p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer flex-shrink-0 self-start sm:self-center">
                  <input type="checkbox" class="toggle-auto-confirm-input sr-only peer" ${currentBiz.autoConfirmAppointments !== false ? 'checked' : ''}>
                  <div class="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
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

  // --- SUB-CONTENIDO: GESTIÓN DE EQUIPO Y ESPECIALISTAS ---
  renderTeamTabContent(currentBiz) {
    const plan = currentBiz.plan || 'basic';
    const isBasic = plan === 'basic';
    const isPro = plan === 'pro';
    const isUnlimited = plan === 'unlimited';

    if (isBasic) {
      return `
        <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
          <div class="max-w-3xl mx-auto text-center py-6">
            <div class="w-16 h-16 rounded-3xl bg-amber-100 text-amber-600 flex items-center justify-center text-2xl mx-auto mb-4 shadow-inner">
              <i class="fas fa-lock"></i>
            </div>
            <span class="text-xs uppercase font-extrabold text-amber-600 tracking-wider">Función Premium</span>
            <h2 class="text-2xl font-black text-slate-900 mt-1">Gestión de Múltiples Especialistas</h2>
            <p class="text-sm text-slate-600 mt-2 max-w-xl mx-auto leading-relaxed">
              El <strong>Plan Básico ($10/mes)</strong> está optimizado para <strong>1 solo operador (Dueño)</strong>. Si cuentas con un equipo de trabajo (barberos, estilistas, terapeutas, manicuristas o médicos), sube de plan para que cada colaborador tenga su propia agenda y disponibilidad independiente.
            </p>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 my-8 text-left">
              <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div class="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold mb-2">
                  <i class="fas fa-users"></i>
                </div>
                <h4 class="text-xs font-bold text-slate-900">Múltiples Colaboradores</h4>
                <p class="text-[11px] text-slate-500 mt-1">Crea perfiles con fotos, especialidades y teléfonos directos.</p>
              </div>

              <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div class="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm font-bold mb-2">
                  <i class="fas fa-calendar-check"></i>
                </div>
                <h4 class="text-xs font-bold text-slate-900">Horarios Independientes</h4>
                <p class="text-[11px] text-slate-500 mt-1">Cada colaborador tiene sus turnos, días libres y descansos propios.</p>
              </div>

              <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div class="w-8 h-8 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center text-sm font-bold mb-2">
                  <i class="fas fa-filter"></i>
                </div>
                <h4 class="text-xs font-bold text-slate-900">Filtro para Clientes</h4>
                <p class="text-[11px] text-slate-500 mt-1">El cliente puede elegir a su especialista favorito o "Cualquiera disponible".</p>
              </div>
            </div>

            <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button id="dash-upgrade-team-pro-btn" class="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer flex items-center justify-center gap-2">
                <i class="fas fa-rocket"></i> Subir a Plan Profesional ($18/mes - Hasta 5 Especialistas)
              </button>
              <button id="dash-upgrade-team-unlimited-btn" class="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-500/20 transition-all cursor-pointer flex items-center justify-center gap-2">
                <i class="fas fa-crown text-amber-300"></i> Plan Ilimitado ($35/mes - Especialistas ∞)
              </button>
            </div>
          </div>
        </div>
      `;
    }

    const staffList = storage.getBusinessStaffSync(currentBiz.id) || [];
    const maxAllowed = isPro ? 5 : Infinity;
    const canAdd = staffList.length < maxAllowed;

    return `
      <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="text-lg font-bold text-slate-900">Equipo de Trabajo y Especialistas</h2>
              <span class="text-xs font-extrabold px-2.5 py-0.5 rounded-full ${isPro ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}">
                ${staffList.length} / ${isPro ? '5' : '∞'} Especialistas (${isPro ? 'Plan Pro' : 'Plan Ilimitado'})
              </span>
            </div>
            <p class="text-xs text-slate-500 mt-1">Configura los integrantes de tu equipo, sus especialidades y sus turnos individuales.</p>
          </div>

          <div class="flex items-center gap-2">
            <button 
              id="add-new-staff-btn" 
              ${!canAdd ? 'disabled title="Has alcanzado el límite de 5 especialistas del Plan Pro"' : ''}
              class="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-blue-500/20 cursor-pointer"
            >
              <i class="fas fa-user-plus"></i> Agregar Especialista
            </button>
          </div>
        </div>

        ${staffList.length === 0 ? `
          <div class="text-center py-12 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
            <div class="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl mx-auto mb-3">
              <i class="fas fa-users-cog"></i>
            </div>
            <h3 class="text-sm font-bold text-slate-800">Aún no has agregado especialistas</h3>
            <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Agrega a los colaboradores de tu local para que tus clientes puedan reservar con ellos específicamente o mediante turno asignado.
            </p>
            <button id="add-new-staff-btn" class="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer">
              <i class="fas fa-plus"></i> Agregar Primer Especialista
            </button>
          </div>
        ` : `
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${staffList.map(st => {
              const svcs = st.services || ['all'];
              const isAll = svcs.includes('all');
              const svcNames = isAll 
                ? 'Todos los servicios del catálogo' 
                : currentBiz.services?.filter(s => svcs.includes(s.id)).map(s => s.name).join(', ') || 'Sin servicios asignados';
              
              const hasCustom = Boolean(st.schedule);

              return `
                <div class="p-5 rounded-3xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-all flex flex-col justify-between space-y-4">
                  <div>
                    <div class="flex items-start justify-between gap-3">
                      <div class="flex items-center gap-3">
                        ${st.avatarUrl ? `
                          <img src="${st.avatarUrl}" alt="${st.name}" class="w-12 h-12 rounded-2xl object-cover border border-slate-200 shadow-xs">
                        ` : `
                          <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-lg font-black shadow-xs">
                            ${st.name.charAt(0).toUpperCase()}
                          </div>
                        `}
                        <div>
                          <h3 class="text-sm font-bold text-slate-900">${st.name}</h3>
                          <span class="text-xs text-blue-600 font-semibold block">${st.roleTitle || 'Especialista'}</span>
                          ${st.phone ? `<span class="text-[11px] text-slate-400 font-mono"><i class="fab fa-whatsapp mr-1 text-emerald-500"></i>${st.phone}</span>` : ''}
                        </div>
                      </div>

                      <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${st.isActive !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}">
                        ${st.isActive !== false ? 'Activo' : 'Pausado'}
                      </span>
                    </div>

                    <div class="mt-4 pt-3 border-t border-slate-200/70 space-y-2 text-xs">
                      <div>
                        <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Servicios:</span>
                        <p class="text-slate-700 text-xs truncate" title="${svcNames}">
                          <i class="fas fa-check-circle text-blue-500 mr-1 text-[11px]"></i>${svcNames}
                        </p>
                      </div>

                      <div>
                        <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Horario:</span>
                        <p class="text-slate-700 text-xs">
                          <i class="fas fa-clock text-slate-400 mr-1 text-[11px]"></i>
                          ${hasCustom ? 'Horario personalizado' : 'Horario general del negocio'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div class="pt-3 border-t border-slate-200 flex items-center justify-between gap-1">
                    <button 
                      class="toggle-staff-status-btn text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${st.isActive !== false ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}"
                      data-staff-id="${st.id}"
                      data-active="${st.isActive !== false}"
                    >
                      <i class="fas ${st.isActive !== false ? 'fa-pause' : 'fa-play'} mr-1"></i>
                      ${st.isActive !== false ? 'Pausar' : 'Activar'}
                    </button>

                    <div class="flex items-center gap-1">
                      <button class="edit-staff-btn text-xs font-bold text-blue-600 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer" data-staff-id="${st.id}">
                        <i class="fas fa-edit mr-1"></i> Editar
                      </button>
                      <button class="delete-staff-btn text-xs font-bold text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer" data-staff-id="${st.id}" data-staff-name="${st.name}">
                        <i class="fas fa-trash-alt"></i>
                      </button>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;
  }

  // --- MODAL: AGREGAR / EDITAR ESPECIALISTA ---
  renderStaffModal(business, staffMember = null) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const isEdit = Boolean(staffMember);
    const services = business.services || [];
    const staffServices = staffMember?.services || ['all'];
    const isAllServices = staffServices.includes('all');

    const bizSchedule = business.schedule || {
      days: [1, 2, 3, 4, 5, 6],
      openTime: '08:00',
      closeTime: '18:00',
      breakStart: '12:00',
      breakEnd: '13:00'
    };

    const hasCustomSchedule = Boolean(staffMember?.schedule);
    const stSchedule = staffMember?.schedule || bizSchedule;

    const dayLabels = [
      { num: 0, label: 'Dom' },
      { num: 1, label: 'Lun' },
      { num: 2, label: 'Mar' },
      { num: 3, label: 'Mié' },
      { num: 4, label: 'Jue' },
      { num: 5, label: 'Vie' },
      { num: 6, label: 'Sáb' }
    ];

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop animate-fade-in overflow-y-auto">
        <div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 my-8">
          <!-- Header -->
          <div class="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 sm:p-6 text-white flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-lg">
                <i class="fas ${isEdit ? 'fa-user-edit' : 'fa-user-plus'}"></i>
              </div>
              <div>
                <span class="text-xs uppercase tracking-wider text-blue-200 font-bold">Gestión de Equipo</span>
                <h3 class="text-xl font-bold">${isEdit ? 'Editar Especialista' : 'Nuevo Especialista'}</h3>
              </div>
            </div>
            <button id="close-staff-modal-btn" class="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors cursor-pointer">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <!-- Form Body -->
          <form id="staff-form" class="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            <!-- Nombre y Cargo -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nombre y Apellidos *
                </label>
                <input 
                  type="text" 
                  id="staff-name-input" 
                  value="${staffMember?.name || ''}" 
                  placeholder="Ej: Mario Ruiz" 
                  required 
                  class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Especialidad / Cargo *
                </label>
                <input 
                  type="text" 
                  id="staff-role-input" 
                  value="${staffMember?.roleTitle || 'Especialista'}" 
                  placeholder="Ej: Barbero Senior, Colorista" 
                  required 
                  class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <!-- WhatsApp y Foto URL -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Teléfono / WhatsApp (Opcional)
                </label>
                <input 
                  type="tel" 
                  id="staff-phone-input" 
                  value="${staffMember?.phone || ''}" 
                  placeholder="+506 8888 7777" 
                  class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Foto / Avatar URL (Opcional)
                </label>
                <input 
                  type="url" 
                  id="staff-avatar-input" 
                  value="${staffMember?.avatarUrl || ''}" 
                  placeholder="https://ejemplo.com/foto.jpg" 
                  class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <!-- Servicios que atiende -->
            <div class="pt-2 border-t border-slate-100">
              <div class="flex items-center justify-between mb-2">
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Servicios que atiende
                </label>
                <label class="flex items-center gap-1.5 text-xs text-blue-600 font-bold cursor-pointer">
                  <input type="checkbox" id="staff-all-services-checkbox" ${isAllServices ? 'checked' : ''} class="rounded text-blue-600 focus:ring-blue-500">
                  <span>Todos los servicios</span>
                </label>
              </div>

              <div id="staff-services-list" class="grid grid-cols-1 sm:grid-cols-2 gap-2 ${isAllServices ? 'opacity-50 pointer-events-none' : ''}">
                ${services.map(srv => `
                  <label class="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-blue-50/50 flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                    <input 
                      type="checkbox" 
                      class="staff-service-chk rounded text-blue-600 focus:ring-blue-500" 
                      value="${srv.id}" 
                      ${(isAllServices || staffServices.includes(srv.id)) ? 'checked' : ''}
                    >
                    <span class="truncate">${srv.name}</span>
                  </label>
                `).join('')}
              </div>
            </div>

            <!-- Horarios de Atención -->
            <div class="pt-2 border-t border-slate-100">
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Horario de Trabajo
              </label>

              <div class="space-y-2 mb-3">
                <label class="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                  <input type="radio" name="staff-schedule-type" value="inherit" ${!hasCustomSchedule ? 'checked' : ''} class="text-blue-600 focus:ring-blue-500">
                  <span>Heredar horario general del negocio (${bizSchedule.openTime || '08:00'} - ${bizSchedule.closeTime || '18:00'})</span>
                </label>
                <label class="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                  <input type="radio" name="staff-schedule-type" value="custom" ${hasCustomSchedule ? 'checked' : ''} class="text-blue-600 focus:ring-blue-500">
                  <span>Personalizar días y horas para este especialista</span>
                </label>
              </div>

              <div id="staff-custom-schedule-box" class="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 ${!hasCustomSchedule ? 'hidden' : ''}">
                <!-- Días laborables -->
                <div>
                  <span class="block text-[11px] font-bold text-slate-600 mb-1.5">Días que labora:</span>
                  <div class="flex items-center gap-1.5 flex-wrap">
                    ${dayLabels.map(d => `
                      <label class="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" class="staff-schedule-day-chk" value="${d.num}" ${(stSchedule.days || [1,2,3,4,5,6]).includes(d.num) ? 'checked' : ''}>
                        <span>${d.label}</span>
                      </label>
                    `).join('')}
                  </div>
                </div>

                <!-- Horas de Apertura y Cierre -->
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-[11px] font-bold text-slate-600 mb-1">Hora Inicio</label>
                    <input type="time" id="staff-open-time" value="${stSchedule.openTime || '08:00'}" class="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800">
                  </div>
                  <div>
                    <label class="block text-[11px] font-bold text-slate-600 mb-1">Hora Fin</label>
                    <input type="time" id="staff-close-time" value="${stSchedule.closeTime || '18:00'}" class="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800">
                  </div>
                </div>

                <!-- Descanso / Almuerzo -->
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-[11px] font-bold text-slate-600 mb-1">Inicio Descanso (Opcional)</label>
                    <input type="time" id="staff-break-start" value="${stSchedule.breakStart || ''}" class="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800">
                  </div>
                  <div>
                    <label class="block text-[11px] font-bold text-slate-600 mb-1">Fin Descanso (Opcional)</label>
                    <input type="time" id="staff-break-end" value="${stSchedule.breakEnd || ''}" class="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800">
                  </div>
                </div>
              </div>
            </div>

            <!-- Botones -->
            <div class="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
              <button type="button" id="cancel-staff-btn" class="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer">
                Cancelar
              </button>
              <button type="submit" id="save-staff-btn" class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer">
                ${isEdit ? 'Actualizar Especialista' : 'Guardar Especialista'}
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.getElementById('close-staff-modal-btn')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
    });

    document.getElementById('cancel-staff-btn')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
    });

    const allServicesChk = document.getElementById('staff-all-services-checkbox');
    const servicesListDiv = document.getElementById('staff-services-list');
    allServicesChk?.addEventListener('change', (e) => {
      if (e.target.checked) {
        servicesListDiv.classList.add('opacity-50', 'pointer-events-none');
        document.querySelectorAll('.staff-service-chk').forEach(c => c.checked = true);
      } else {
        servicesListDiv.classList.remove('opacity-50', 'pointer-events-none');
      }
    });

    const customScheduleBox = document.getElementById('staff-custom-schedule-box');
    document.querySelectorAll('input[name="staff-schedule-type"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
          customScheduleBox.classList.remove('hidden');
        } else {
          customScheduleBox.classList.add('hidden');
        }
      });
    });

    document.getElementById('staff-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('staff-name-input').value.trim();
      const roleTitle = document.getElementById('staff-role-input').value.trim();
      const phone = document.getElementById('staff-phone-input').value.trim();
      const avatarUrl = document.getElementById('staff-avatar-input').value.trim();

      const isAll = document.getElementById('staff-all-services-checkbox').checked;
      let selectedServices = ['all'];
      if (!isAll) {
        selectedServices = Array.from(document.querySelectorAll('.staff-service-chk:checked')).map(c => c.value);
        if (selectedServices.length === 0) selectedServices = ['all'];
      }

      const scheduleType = document.querySelector('input[name="staff-schedule-type"]:checked')?.value || 'inherit';
      let customSchedule = null;
      if (scheduleType === 'custom') {
        const days = Array.from(document.querySelectorAll('.staff-schedule-day-chk:checked')).map(c => parseInt(c.value, 10));
        const openTime = document.getElementById('staff-open-time').value;
        const closeTime = document.getElementById('staff-close-time').value;
        const breakStart = document.getElementById('staff-break-start').value || null;
        const breakEnd = document.getElementById('staff-break-end').value || null;
        customSchedule = {
          days: days.length > 0 ? days : [1, 2, 3, 4, 5, 6],
          openTime: openTime || '08:00',
          closeTime: closeTime || '18:00',
          breakStart,
          breakEnd
        };
      }

      const payload = {
        name,
        roleTitle,
        phone,
        avatarUrl,
        services: selectedServices,
        schedule: customSchedule,
        isActive: staffMember ? staffMember.isActive : true
      };

      try {
        if (isEdit) {
          await storage.updateStaffMember(business.id, staffMember.id, payload);
          this.showToast('Especialista actualizado con éxito.', 'success');
        } else {
          await storage.createStaffMember(business.id, payload);
          this.showToast('Especialista agregado con éxito.', 'success');
        }
        modalContainer.innerHTML = '';
        this.renderCurrentView();
      } catch (err) {
        this.showToast(err.message || 'Error al guardar especialista.', 'error');
      }
    });
  }

  // --- SUB-CONTENIDO: BLOQUEOS Y GESTIÓN VISUAL DE HORARIOS ---
  renderBlockedSlotsTabContent(currentBiz, appointments) {
    const selectedDate = this.selectedBlockedSlotsDate || this.getTodayDateString();
    const sch = currentBiz.schedule || { days: [1, 2, 3, 4, 5, 6], openTime: '08:00', closeTime: '18:00', slotDuration: 30 };
    
    // Calcular día de la semana para saber si labora normalmente
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayOfWeek = dateObj.getDay();
    const isWorkingDay = sch.days && sch.days.includes(dayOfWeek);

    const timeToMinutes = (timeStr) => {
      if (!timeStr) return 0;
      let str = String(timeStr).trim().toUpperCase();
      const isPM = str.includes('PM');
      const isAM = str.includes('AM');
      str = str.replace(/[APM\s]/g, '');
      const [hStr, mStr] = str.split(':');
      let h = parseInt(hStr, 10) || 0;
      const min = parseInt(mStr, 10) || 0;
      if (isPM && h < 12) h += 12;
      if (isAM && h === 12) h = 0;
      return h * 60 + min;
    };

    const minutesToTime = (totalMinutes) => {
      const totalH = Math.floor(totalMinutes / 60);
      const min = (totalMinutes % 60).toString().padStart(2, '0');
      const period = totalH >= 12 ? 'PM' : 'AM';
      let hour12 = totalH % 12;
      if (hour12 === 0) hour12 = 12;
      return `${hour12}:${min} ${period}`;
    };

    const openMin = timeToMinutes(sch.openTime || '08:00');
    const closeMin = timeToMinutes(sch.closeTime || '18:00');
    const breakStartMin = sch.breakStart ? timeToMinutes(sch.breakStart) : -1;
    const breakEndMin = sch.breakEnd ? timeToMinutes(sch.breakEnd) : -1;
    const slotStep = sch.slotDuration || 30;

    // Citas existentes del día
    const dayAppointments = appointments.filter(a => a.date === selectedDate && a.status !== 'cancelled');
    const bookedRanges = dayAppointments.map(appt => {
      const start = timeToMinutes(appt.time);
      const duration = appt.serviceDuration || 30;
      return { start, end: start + duration, appointment: appt };
    });

    // Franjas bloqueadas por el comercio
    const blockedSlots = storage.getBlockedSlots(currentBiz.id, selectedDate);
    const blockedTimesSet = new Set(blockedSlots.map(b => b.time));

    // Generar todas las franjas
    const slots = [];
    for (let current = openMin; current + slotStep <= closeMin; current += slotStep) {
      const slotEnd = current + slotStep;
      const timeStr = minutesToTime(current);

      const bookedOverlap = bookedRanges.find(b => current < b.end && slotEnd > b.start);
      const isManualBlocked = blockedSlots.some(b => {
        const bStart = timeToMinutes(b.time);
        const is15 = (bStart % 30 !== 0);
        const bDur = is15 ? 15 : (slotStep === 15 ? 15 : 30);
        return current < (bStart + bDur) && slotEnd > bStart;
      });
      const isBreak = (breakStartMin !== -1 && breakEndMin !== -1 && current < breakEndMin && slotEnd > breakStartMin);

      let status = 'available'; // 'available' | 'blocked' | 'booked' | 'break'
      let aptInfo = null;

      if (bookedOverlap) {
        status = 'booked';
        aptInfo = bookedOverlap.appointment;
      } else if (isManualBlocked) {
        status = 'blocked';
      } else if (isBreak) {
        status = 'break';
      }

      slots.push({
        timeStr,
        currentMin: current,
        status,
        appointment: aptInfo
      });
    }

    const availableCount = slots.filter(s => s.status === 'available').length;
    const blockedCount = slots.filter(s => s.status === 'blocked').length;
    const bookedCount = slots.filter(s => s.status === 'booked').length;
    const breakCount = slots.filter(s => s.status === 'break').length;

    const todayStr = this.getTodayDateString();
    const tomorrowObj = new Date();
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrowStr = tomorrowObj.toISOString().slice(0, 10);
    const dayAfterObj = new Date();
    dayAfterObj.setDate(dayAfterObj.getDate() + 2);
    const dayAfterStr = dayAfterObj.toISOString().slice(0, 10);

    return `
      <div class="space-y-6 animate-fade-in">
        <!-- Banner Explicativo -->
        <div class="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-lg border border-blue-800/40 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div class="space-y-2">
            <div class="inline-flex items-center gap-2 bg-blue-500/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-blue-300 border border-blue-400/30">
              <i class="fas fa-magic"></i> Control Total de Disponibilidad
            </div>
            <h2 class="text-xl sm:text-2xl font-black">Bloqueo y Liberación de Horarios</h2>
            <p class="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Toca cualquier franja horaria para <strong>bloquearla</strong> (rojo) o <strong>liberarla</strong> (verde) al instante. Los horarios bloqueados no estarán disponibles para que los clientes reserven en la página.
            </p>
          </div>

          <div class="flex flex-wrap sm:flex-nowrap items-center gap-2 flex-shrink-0">
            <button id="btn-block-all-day" class="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer">
              <i class="fas fa-lock"></i> Bloquear Todo el Día
            </button>
            <button id="btn-unblock-all-day" class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer">
              <i class="fas fa-unlock"></i> Liberar Todo el Día
            </button>
          </div>
        </div>

        <!-- Selector de Fecha y Barra de Estado -->
        <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <!-- Navegación de Fecha -->
            <div class="flex items-center gap-2 flex-wrap">
              <button id="btn-prev-day" class="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors text-xs font-bold cursor-pointer" title="Día Anterior">
                <i class="fas fa-chevron-left"></i>
              </button>

              <div class="relative">
                <input type="date" id="blocked-slots-date-picker" value="${selectedDate}" class="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer">
              </div>

              <button id="btn-next-day" class="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors text-xs font-bold cursor-pointer" title="Día Siguiente">
                <i class="fas fa-chevron-right"></i>
              </button>

              <!-- Atajos Rápidos de Fecha -->
              <div class="flex items-center gap-1.5 ml-1">
                <button class="quick-date-btn px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${selectedDate === todayStr ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}" data-date="${todayStr}">
                  Hoy
                </button>
                <button class="quick-date-btn px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${selectedDate === tomorrowStr ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}" data-date="${tomorrowStr}">
                  Mañana
                </button>
                <button class="quick-date-btn px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${selectedDate === dayAfterStr ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}" data-date="${dayAfterStr}">
                  Pasado Mañana
                </button>
              </div>
            </div>

            <!-- Título de Fecha Seleccionada -->
            <div class="text-left lg:text-right">
              <h3 class="text-base sm:text-lg font-black text-slate-900 capitalize">
                ${this.formatDateFullSpanish(selectedDate)}
              </h3>
              <div class="flex items-center lg:justify-end gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                <span class="inline-flex items-center gap-1">
                  <i class="far fa-clock text-blue-600"></i> Horario: <strong>${this.formatTime12h(sch.openTime || '08:00')} - ${this.formatTime12h(sch.closeTime || '18:00')}</strong> (cada ${slotStep}m)
                </span>
                ${!isWorkingDay ? `
                  <span class="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md font-bold text-[10px]">
                    ⚠️ Día No Laboral según Horarios
                  </span>
                ` : ''}
              </div>
            </div>
          </div>

          <!-- Leyenda de Estados y Contadores -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-emerald-900 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-3.5 h-3.5 rounded-full bg-emerald-500 ring-4 ring-emerald-200 flex-shrink-0"></span>
                <div>
                  <span class="text-xs font-black block">Disponibles</span>
                  <span class="text-[10px] text-emerald-700">Libres para reservar</span>
                </div>
              </div>
              <span class="text-lg font-black text-emerald-800">${availableCount}</span>
            </div>

            <div class="p-3.5 rounded-2xl bg-rose-50/80 border border-rose-200 text-rose-900 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-3.5 h-3.5 rounded-full bg-rose-500 ring-4 ring-rose-200 flex-shrink-0"></span>
                <div>
                  <span class="text-xs font-black block">Bloqueados</span>
                  <span class="text-[10px] text-rose-700">Pausados por ti</span>
                </div>
              </div>
              <span class="text-lg font-black text-rose-800">${blockedCount}</span>
            </div>

            <div class="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200 text-blue-900 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-3.5 h-3.5 rounded-full bg-blue-600 ring-4 ring-blue-200 flex-shrink-0"></span>
                <div>
                  <span class="text-xs font-black block">Reservas Clientes</span>
                  <span class="text-[10px] text-blue-700">Ya agendadas</span>
                </div>
              </div>
              <span class="text-lg font-black text-blue-800">${bookedCount}</span>
            </div>

            <div class="p-3.5 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-3.5 h-3.5 rounded-full bg-slate-400 ring-4 ring-slate-200 flex-shrink-0"></span>
                <div>
                  <span class="text-xs font-black block">Receso / Almuerzo</span>
                  <span class="text-[10px] text-slate-500">Horario de descanso</span>
                </div>
              </div>
              <span class="text-lg font-black text-slate-700">${breakCount}</span>
            </div>
          </div>

          <!-- Cuadrícula Interactiva de Franjas Horarias -->
          <div class="pt-2">
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              ${slots.map(slot => {
                if (slot.status === 'booked') {
                  const apt = slot.appointment;
                  return `
                    <button class="slot-booked-btn group relative p-3.5 rounded-2xl border-2 border-blue-300 bg-blue-50/90 text-blue-950 text-left transition-all hover:shadow-md hover:border-blue-500 cursor-pointer flex flex-col justify-between" data-apt-id="${apt.id}">
                      <div class="flex items-center justify-between">
                        <span class="font-extrabold text-sm text-blue-950 font-mono">${this.formatTime12h(slot.timeStr)}</span>
                        <span class="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                      </div>
                      <div class="mt-2 text-[11px] font-bold truncate text-blue-900" title="${this.escapeHtml(apt.clientName)}">
                        <i class="far fa-user text-blue-600 mr-1"></i>${apt.clientName}
                      </div>
                      <div class="text-[10px] text-blue-700 truncate mt-0.5">
                        ${apt.serviceName}
                      </div>
                      <span class="mt-2 text-[9px] font-black uppercase text-blue-600 bg-blue-100 px-2 py-0.5 rounded-md inline-block text-center">
                        Reserva #${apt.id.toUpperCase().slice(-4)}
                      </span>
                    </button>
                  `;
                }

                if (slot.status === 'blocked') {
                  return `
                    <button class="interactive-slot-btn p-3.5 rounded-2xl border-2 border-rose-300 bg-rose-50 text-rose-950 text-left transition-all hover:bg-rose-100 hover:border-rose-400 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex flex-col justify-between shadow-2xs" data-time="${slot.timeStr}" data-status="blocked" title="Toca para desbloquear y poner disponible">
                      <div class="flex items-center justify-between">
                        <span class="font-black text-sm text-rose-950 font-mono">${this.formatTime12h(slot.timeStr)}</span>
                        <i class="fas fa-lock text-rose-600 text-xs"></i>
                      </div>
                      <div class="mt-3 flex items-center justify-between">
                        <span class="text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-200/80 px-2 py-0.5 rounded-md">
                          Bloqueado
                        </span>
                        <span class="text-[10px] text-rose-600 font-bold">
                          Liberar <i class="fas fa-arrow-right text-[9px]"></i>
                        </span>
                      </div>
                    </button>
                  `;
                }

                if (slot.status === 'break') {
                  return `
                    <div class="p-3.5 rounded-2xl border border-slate-200 bg-slate-100 text-slate-500 text-left flex flex-col justify-between opacity-80 cursor-not-allowed">
                      <div class="flex items-center justify-between">
                        <span class="font-bold text-sm text-slate-600 font-mono">${this.formatTime12h(slot.timeStr)}</span>
                        <i class="fas fa-coffee text-slate-400 text-xs"></i>
                      </div>
                      <div class="mt-3">
                        <span class="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-md">
                          Almuerzo / Receso
                        </span>
                      </div>
                    </div>
                  `;
                }

                // Default: available
                return `
                  <button class="interactive-slot-btn p-3.5 rounded-2xl border-2 border-emerald-300 bg-emerald-50/70 text-emerald-950 text-left transition-all hover:bg-emerald-100/80 hover:border-emerald-500 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex flex-col justify-between shadow-2xs" data-time="${slot.timeStr}" data-status="available" title="Toca para bloquear esta hora">
                    <div class="flex items-center justify-between">
                      <span class="font-black text-sm text-emerald-950 font-mono">${this.formatTime12h(slot.timeStr)}</span>
                      <i class="fas fa-check-circle text-emerald-600 text-xs"></i>
                    </div>
                    <div class="mt-3 flex items-center justify-between">
                      <span class="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-200/80 px-2 py-0.5 rounded-md">
                        Disponible
                      </span>
                      <span class="text-[10px] text-emerald-700 font-bold">
                        Bloquear <i class="fas fa-ban text-[9px]"></i>
                      </span>
                    </div>
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderBookedSlotAppointmentModal(apt) {
    const modalContainer = document.getElementById('modal-container') || document.createElement('div');
    modalContainer.id = 'modal-container';
    if (!document.getElementById('modal-container')) {
      document.body.appendChild(modalContainer);
    }

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
        <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100">
          <div class="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-lg">
                <i class="fas fa-calendar-check"></i>
              </div>
              <div>
                <span class="text-[10px] uppercase font-bold tracking-widest text-blue-200 block">Detalle de Reserva</span>
                <h3 class="text-base font-black">Reserva #${apt.id.toUpperCase()}</h3>
              </div>
            </div>
            <button id="close-booked-slot-modal-btn" class="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors cursor-pointer">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <div class="p-6 space-y-4 text-xs">
            <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
              <div class="flex justify-between">
                <span class="text-slate-500">Cliente:</span>
                <span class="font-extrabold text-slate-900">${apt.clientName}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Teléfono:</span>
                <span class="font-bold text-slate-800">${apt.clientPhone}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Email:</span>
                <span class="font-medium text-slate-700">${apt.clientEmail || 'No especificado'}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Servicio:</span>
                <span class="font-bold text-blue-600">${apt.serviceName} (${apt.serviceDuration} min)</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Fecha y Hora:</span>
                <span class="font-extrabold text-slate-900">${this.formatDateDMY(apt.date)} a las ${this.formatTime12h(apt.time)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Monto:</span>
                <span class="font-black text-slate-900">${this.formatColones(apt.servicePrice)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Estado:</span>
                <span class="badge-status badge-status-${apt.status}">
                  ${apt.status === 'confirmed' ? 'Confirmada' : apt.status === 'pending' ? 'Pendiente' : apt.status === 'completed' ? 'Completada' : 'Cancelada'}
                </span>
              </div>
              ${apt.notes ? `
                <div class="pt-2 border-t border-slate-200">
                  <span class="text-slate-500 block mb-1">Notas del cliente:</span>
                  <div class="italic text-slate-700 bg-white p-2.5 rounded-xl border border-slate-100">${this.escapeHtml(apt.notes)}</div>
                </div>
              ` : ''}
            </div>

            <div class="flex items-center gap-2 pt-2">
              <button id="modal-manage-reschedule-btn" class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
                <i class="fas fa-edit"></i> Modificar / Reagendar
              </button>
              <button id="close-booked-slot-modal-btn2" class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const closeModal = () => { modalContainer.innerHTML = ''; };
    document.getElementById('close-booked-slot-modal-btn')?.addEventListener('click', closeModal);
    document.getElementById('close-booked-slot-modal-btn2')?.addEventListener('click', closeModal);
    document.getElementById('modal-manage-reschedule-btn')?.addEventListener('click', () => {
      closeModal();
      this.renderRescheduleModal(apt, true);
    });
  }

  // --- LISTENERS ESPECÍFICOS DEL DASHBOARD ---
  setupDashboardTabEvents(currentBiz) {
    // Switch de Autoconfirmación de Reservas (en Agenda y en Horarios)
    const handleAutoConfirmToggle = async (isChecked) => {
      await storage.updateBusinessAutoConfirm(currentBiz.id, isChecked);
      currentBiz.autoConfirmAppointments = isChecked;
      this.showToast(
        isChecked 
          ? '⚡ ¡Autoconfirmación activada! Las reservas se confirmarán y notificarán al instante.' 
          : '✋ Modo manual activado: Las reservas requerirán tu aprobación antes de enviar correo y WhatsApp.',
        'success'
      );
      this.renderCurrentView();
    };

    document.getElementById('toggle-auto-confirm-switch')?.addEventListener('change', async (e) => {
      await handleAutoConfirmToggle(e.target.checked);
    });

    document.querySelectorAll('.toggle-auto-confirm-input').forEach(input => {
      input.addEventListener('change', async (e) => {
        await handleAutoConfirmToggle(e.target.checked);
      });
    });

    document.querySelectorAll('.owner-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.ownerAppointmentFilter = btn.getAttribute('data-filter');
        this.renderCurrentView();
      });
    });

    document.querySelectorAll('.edit-appointment-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const aptId = btn.getAttribute('data-apt-id');
        const appointments = storage.getAppointmentsByBusiness(currentBiz.id);
        const apt = appointments.find(a => a.id === aptId);
        if (apt) {
          this.renderRescheduleModal(apt, true);
        }
      });
    });

    document.querySelectorAll('.status-change-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const aptId = btn.getAttribute('data-apt-id');
        const newStatus = btn.getAttribute('data-status');
        await storage.updateAppointmentStatus(aptId, newStatus);
        const statusMsgs = {
          confirmed: '✅ ¡Reserva confirmada! Se enviaron las notificaciones por WhatsApp y correo al cliente.',
          completed: '🎉 ¡Reserva completada! Se envió automáticamente la solicitud de calificación por correo al cliente.',
          cancelled: '❌ Reserva cancelada.'
        };
        this.showToast(statusMsgs[newStatus] || `Estado actualizado a: ${newStatus}`, newStatus === 'cancelled' ? 'info' : 'success');
        this.renderCurrentView();
      });
    });

    document.querySelectorAll('.delete-apt-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const aptId = btn.getAttribute('data-apt-id');
        if (confirm('¿Deseas eliminar este registro de reserva permanentemente?')) {
          await storage.deleteAppointment(aptId);
          this.showToast('Reserva eliminada.', 'info');
          this.renderCurrentView();
        }
      });
    });

    // Filtro por Especialista en Agenda
    const staffFilterSelect = document.getElementById('owner-staff-filter-select');
    staffFilterSelect?.addEventListener('change', (e) => {
      this.ownerStaffFilter = e.target.value;
      this.renderCurrentView();
    });

    // Pestaña de Equipo / Especialistas
    document.getElementById('add-new-staff-btn')?.addEventListener('click', () => {
      this.renderStaffModal(currentBiz);
    });

    document.getElementById('dash-upgrade-team-pro-btn')?.addEventListener('click', () => {
      this.renderPlansModal({ businessId: currentBiz.id, currentPlanId: currentBiz.plan || 'basic' });
    });

    document.getElementById('dash-upgrade-team-unlimited-btn')?.addEventListener('click', () => {
      this.renderPlansModal({ businessId: currentBiz.id, currentPlanId: currentBiz.plan || 'basic' });
    });

    document.querySelectorAll('.edit-staff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const staffId = btn.getAttribute('data-staff-id');
        const staffList = storage.getBusinessStaffSync(currentBiz.id);
        const member = staffList.find(s => s.id === staffId);
        if (member) {
          this.renderStaffModal(currentBiz, member);
        }
      });
    });

    document.querySelectorAll('.delete-staff-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const staffId = btn.getAttribute('data-staff-id');
        const staffName = btn.getAttribute('data-staff-name') || 'este especialista';
        if (confirm(`¿Estás seguro de que deseas eliminar a ${staffName}? Sus citas históricas se mantendrán registradas.`)) {
          try {
            await storage.deleteStaffMember(currentBiz.id, staffId);
            this.showToast('Especialista eliminado correctamente.', 'success');
            this.renderCurrentView();
          } catch (err) {
            this.showToast(err.message || 'Error al eliminar especialista.', 'error');
          }
        }
      });
    });

    document.querySelectorAll('.toggle-staff-status-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const staffId = btn.getAttribute('data-staff-id');
        const currentActive = btn.getAttribute('data-active') === 'true';
        try {
          await storage.updateStaffMember(currentBiz.id, staffId, { isActive: !currentActive });
          this.showToast(!currentActive ? 'Especialista activado.' : 'Especialista pausado.', 'info');
          this.renderCurrentView();
        } catch (err) {
          this.showToast(err.message || 'Error al cambiar estado.', 'error');
        }
      });
    });

    document.getElementById('add-manual-appointment-btn')?.addEventListener('click', () => {
      this.openBookingModal(currentBiz.id, currentBiz.services && currentBiz.services[0]?.id);
    });

    document.getElementById('dash-export-csv-btn')?.addEventListener('click', () => {
      const appointments = storage.getAppointmentsByBusiness(currentBiz.id);
      if (appointments.length === 0) {
        this.showToast('No hay reservas registradas para exportar.', 'info');
        return;
      }
      const headers = ['ID Reserva', 'Fecha', 'Hora', 'Cliente', 'Teléfono', 'Email', 'Servicio', 'Precio CRC', 'Duración Min', 'Estado', 'Notas'];
      const rows = appointments.map(a => [
        `"${a.id}"`,
        `"${a.date}"`,
        `"${a.time}"`,
        `"${(a.clientName || '').replace(/"/g, '""')}"`,
        `"${a.clientPhone || ''}"`,
        `"${a.clientEmail || ''}"`,
        `"${(a.serviceName || '').replace(/"/g, '""')}"`,
        a.servicePrice || 0,
        a.serviceDuration || 30,
        `"${a.status}"`,
        `"${(a.notes || '').replace(/"/g, '""')}"`
      ]);
      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `clientes_${currentBiz.name.replace(/\s+/g, '_')}_${this.getTodayDateString()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      this.showToast('¡Base de datos de clientes exportada exitosamente!', 'success');
    });

    document.getElementById('dash-upgrade-prompt-btn')?.addEventListener('click', () => {
      this.renderPlansModal({ businessId: currentBiz.id, currentPlanId: currentBiz.plan });
    });

    document.getElementById('add-new-service-btn')?.addEventListener('click', () => {
      this.renderNewServiceModal(currentBiz.id);
    });

    document.querySelectorAll('.edit-service-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sId = btn.getAttribute('data-service-id');
        const service = currentBiz.services?.find(s => s.id === sId);
        if (service) {
          this.renderEditServiceModal(currentBiz.id, service);
        }
      });
    });

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
      const instagram = document.getElementById('edit-biz-instagram')?.value.trim() || '';
      const facebook = document.getElementById('edit-biz-facebook')?.value.trim() || '';
      const tiktok = document.getElementById('edit-biz-tiktok')?.value.trim() || '';
      const website = document.getElementById('edit-biz-website')?.value.trim() || '';
      const socialLinks = { instagram, facebook, tiktok, website };
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
        features,
        socialLinks
      });

      this.showToast('¡Perfil del negocio actualizado con éxito!', 'success');
      this.renderCurrentView();
    });

    const scheduleForm = document.getElementById('schedule-form');
    scheduleForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const selectedDays = Array.from(document.querySelectorAll('input[name="work_days"]:checked')).map(cb => parseInt(cb.value, 10));
      const openTime = document.getElementById('open-time').value;
      const closeTime = document.getElementById('close-time').value;
      const breakStart = document.getElementById('break-start').value;
      const breakEnd = document.getElementById('break-end').value;
      const slotDurationInput = document.querySelector('input[name="slot_duration"]:checked');
      const slotDuration = slotDurationInput ? parseInt(slotDurationInput.value, 10) : (currentBiz.schedule?.slotDuration || 30);

      currentBiz.schedule = {
        days: selectedDays,
        openTime,
        closeTime,
        breakStart: breakStart || null,
        breakEnd: breakEnd || null,
        slotDuration: slotDuration === 15 ? 15 : 30
      };

      await storage.saveBusiness(currentBiz);
      this.showToast('Horarios actualizados exitosamente.', 'success');
      this.renderCurrentView();
    });

    // Accesos Rápidos a Bloqueos desde otras pestañas
    document.getElementById('quick-manage-slots-btn')?.addEventListener('click', () => {
      this.activeDashboardTab = 'blocked-slots';
      this.renderCurrentView();
    });

    document.getElementById('quick-manage-slots-from-services-btn')?.addEventListener('click', () => {
      this.activeDashboardTab = 'blocked-slots';
      this.renderCurrentView();
    });

    // --- LISTENERS DE LA PESTAÑA BLOQUEOS Y HORAS ---
    const datePicker = document.getElementById('blocked-slots-date-picker');
    datePicker?.addEventListener('change', (e) => {
      if (e.target.value) {
        this.selectedBlockedSlotsDate = e.target.value;
        this.renderCurrentView();
      }
    });

    document.getElementById('btn-prev-day')?.addEventListener('click', () => {
      const cur = this.selectedBlockedSlotsDate || this.getTodayDateString();
      const [y, m, d] = cur.split('-').map(Number);
      const prevDate = new Date(y, m - 1, d - 1);
      const prevY = prevDate.getFullYear();
      const prevM = String(prevDate.getMonth() + 1).padStart(2, '0');
      const prevD = String(prevDate.getDate()).padStart(2, '0');
      this.selectedBlockedSlotsDate = `${prevY}-${prevM}-${prevD}`;
      this.renderCurrentView();
    });

    document.getElementById('btn-next-day')?.addEventListener('click', () => {
      const cur = this.selectedBlockedSlotsDate || this.getTodayDateString();
      const [y, m, d] = cur.split('-').map(Number);
      const nextDate = new Date(y, m - 1, d + 1);
      const nextY = nextDate.getFullYear();
      const nextM = String(nextDate.getMonth() + 1).padStart(2, '0');
      const nextD = String(nextDate.getDate()).padStart(2, '0');
      this.selectedBlockedSlotsDate = `${nextY}-${nextM}-${nextD}`;
      this.renderCurrentView();
    });

    document.querySelectorAll('.quick-date-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedBlockedSlotsDate = btn.getAttribute('data-date');
        this.renderCurrentView();
      });
    });

    // Clic en Franja Horaria (Disponible o Bloqueada)
    document.querySelectorAll('.interactive-slot-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const timeStr = btn.getAttribute('data-time');
        const selectedDate = this.selectedBlockedSlotsDate || this.getTodayDateString();
        btn.classList.add('opacity-50', 'pointer-events-none');
        try {
          const res = await storage.toggleBlockedSlot(currentBiz.id, selectedDate, timeStr);
          if (res && res.action === 'blocked') {
            this.showToast(`🔒 Franja ${this.formatTime12h(timeStr)} bloqueada exitosamente.`, 'info');
          } else {
            this.showToast(`🔓 Franja ${this.formatTime12h(timeStr)} liberada y disponible para reservas.`, 'success');
          }
        } catch (err) {
          this.showToast('Error al actualizar disponibilidad de horario.', 'error');
        }
        this.renderCurrentView();
      });
    });

    // Clic en Cita Agendada (ver detalle)
    document.querySelectorAll('.slot-booked-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const aptId = btn.getAttribute('data-apt-id');
        const appointments = storage.getAppointmentsByBusiness(currentBiz.id);
        const apt = appointments.find(a => a.id === aptId);
        if (apt) {
          this.renderBookedSlotAppointmentModal(apt);
        }
      });
    });

    // Bloquear Todo el Día
    document.getElementById('btn-block-all-day')?.addEventListener('click', async () => {
      const selectedDate = this.selectedBlockedSlotsDate || this.getTodayDateString();
      const sch = currentBiz.schedule || { openTime: '08:00', closeTime: '18:00', slotDuration: 30 };
      
      const timeToMinutes = (timeStr) => {
        if (!timeStr) return 0;
        let str = String(timeStr).trim().toUpperCase();
        const isPM = str.includes('PM');
        const isAM = str.includes('AM');
        str = str.replace(/[APM\s]/g, '');
        const [hStr, mStr] = str.split(':');
        let h = parseInt(hStr, 10) || 0;
        const min = parseInt(mStr, 10) || 0;
        if (isPM && h < 12) h += 12;
        if (isAM && h === 12) h = 0;
        return h * 60 + min;
      };

      const minutesToTime = (totalMinutes) => {
        const totalH = Math.floor(totalMinutes / 60);
        const min = (totalMinutes % 60).toString().padStart(2, '0');
        const period = totalH >= 12 ? 'PM' : 'AM';
        let hour12 = totalH % 12;
        if (hour12 === 0) hour12 = 12;
        return `${hour12}:${min} ${period}`;
      };

      const openMin = timeToMinutes(sch.openTime || '08:00');
      const closeMin = timeToMinutes(sch.closeTime || '18:00');
      const slotStep = sch.slotDuration || 30;

      const allTimes = [];
      for (let cur = openMin; cur + slotStep <= closeMin; cur += slotStep) {
        allTimes.push(minutesToTime(cur));
      }

      if (confirm(`¿Deseas bloquear todas las franjas horarias (${allTimes.length} turnos) del día ${this.formatDateDMY(selectedDate)} para que nadie pueda agendar?`)) {
        await storage.setDayBlockedSlots(currentBiz.id, selectedDate, allTimes, 'block_all');
        this.showToast(`🔒 Todas las horas del ${this.formatDateDMY(selectedDate)} han sido bloqueadas.`, 'info');
        this.renderCurrentView();
      }
    });

    // Liberar Todo el Día
    document.getElementById('btn-unblock-all-day')?.addEventListener('click', async () => {
      const selectedDate = this.selectedBlockedSlotsDate || this.getTodayDateString();
      if (confirm(`¿Deseas eliminar todos los bloqueos manuales y restablecer la disponibilidad normal para el día ${this.formatDateDMY(selectedDate)}?`)) {
        await storage.setDayBlockedSlots(currentBiz.id, selectedDate, [], 'unblock_all');
        this.showToast(`🔓 Todos los bloqueos del ${this.formatDateDMY(selectedDate)} han sido eliminados.`, 'success');
        this.renderCurrentView();
      }
    });
  }

  // ==========================================
  // VISTA 5: PANEL SUPERADMIN DEVELOPER
  // ==========================================
  async renderDeveloperDashboardView(container) {
    const devUser = storage.getDeveloperUser();
    if (!devUser) {
      container.innerHTML = `
        <div class="max-w-md mx-auto my-16 p-8 bg-white rounded-3xl border border-slate-200 text-center shadow-lg">
          <div class="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
            <i class="fas fa-lock"></i>
          </div>
          <h2 class="text-xl font-bold text-slate-800 mb-2">Acceso Restringido</h2>
          <p class="text-sm text-slate-500 mb-6">Esta sección es de uso exclusivo para el equipo de desarrollo y administración de Reservas CR.</p>
          <button id="dev-back-home-btn" class="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-md hover:bg-blue-700 transition-all">
            Ir al Inicio
          </button>
        </div>
      `;
      document.getElementById('dev-back-home-btn')?.addEventListener('click', () => this.navigateTo('directory'));
      return;
    }

    // Mostrar loader mientras cargan los datos
    container.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div class="flex items-center justify-center py-20 text-slate-400 gap-3">
          <i class="fas fa-circle-notch fa-spin text-2xl text-blue-600"></i>
          <span class="font-medium text-slate-600">Cargando panel de Developer...</span>
        </div>
      </div>
    `;

    try {
      const [stats, businesses, clients, appointments, alerts, waSettings, preRegistrations, paypalConfig, cleanupStats] = await Promise.all([
        storage.getDeveloperStats(),
        storage.getDeveloperBusinesses(),
        storage.getDeveloperClients(),
        storage.getDeveloperAppointments(),
        storage.getDeveloperCategoryAlerts(),
        storage.getWhatsAppSettings(),
        storage.getPreRegistrations(),
        storage.getPayPalConfig(),
        storage.getCleanupStats()
      ]);

      const pendingAlerts = alerts.filter(a => a.status === 'unread' || a.status === 'pending');
      const q = (this.devSearchQuery || '').toLowerCase().trim();

      // Métricas y filtrado por sub-pestañas en negocios
      const activeBusinessesCount = businesses.filter(b => !b.isHidden && !b.isBlocked).length;
      const hiddenBusinessesCount = businesses.filter(b => b.isHidden).length;
      const blockedBusinessesCount = businesses.filter(b => b.isBlocked).length;
      const realBusinessesCount = businesses.filter(b => !b.isDemo).length;
      const demoBusinessesCount = businesses.filter(b => b.isDemo).length;

      let devBusinessesList = businesses;
      if (this.devBizFilter === 'active') {
        devBusinessesList = businesses.filter(b => !b.isHidden && !b.isBlocked);
      } else if (this.devBizFilter === 'hidden') {
        devBusinessesList = businesses.filter(b => b.isHidden);
      } else if (this.devBizFilter === 'blocked') {
        devBusinessesList = businesses.filter(b => b.isBlocked);
      } else if (this.devBizFilter === 'real') {
        devBusinessesList = businesses.filter(b => !b.isDemo);
      } else if (this.devBizFilter === 'demo') {
        devBusinessesList = businesses.filter(b => b.isDemo);
      }

      // Filtrado por buscador
      const filteredBusinesses = devBusinessesList.filter(b => 
        !q || (b.name && b.name.toLowerCase().includes(q)) || 
        (b.categoryLabel && b.categoryLabel.toLowerCase().includes(q)) || 
        (b.email && b.email.toLowerCase().includes(q)) || 
        (b.city && b.city.toLowerCase().includes(q))
      );

      const filteredClients = clients.filter(c => 
        !q || (c.name && c.name.toLowerCase().includes(q)) || 
        (c.phone && c.phone.toLowerCase().includes(q)) || 
        (c.email && c.email.toLowerCase().includes(q))
      );

      const filteredAppointments = appointments.filter(a => 
        !q || ((a.clientName || a.client_name) && (a.clientName || a.client_name).toLowerCase().includes(q)) || 
        ((a.businessName || a.business_name) && (a.businessName || a.business_name).toLowerCase().includes(q)) || 
        ((a.serviceName || a.service_name) && (a.serviceName || a.service_name).toLowerCase().includes(q))
      );

      const filteredAlerts = alerts.filter(a => 
        !q || ((a.businessName || a.business_name) && (a.businessName || a.business_name).toLowerCase().includes(q)) || 
        ((a.categoryName || a.category_name) && (a.categoryName || a.category_name).toLowerCase().includes(q))
      );

      const pendingSinpeBusinesses = businesses.filter(b => b.subscriptionStatus === 'pending_sinpe' || b.subscription_status === 'pending_sinpe');
      const filteredSinpeBusinesses = pendingSinpeBusinesses.filter(b => 
        !q || (b.name && b.name.toLowerCase().includes(q)) || 
        (b.email && b.email.toLowerCase().includes(q)) || 
        (b.phone && b.phone.toLowerCase().includes(q)) ||
        (b.city && b.city.toLowerCase().includes(q))
      );

      const filteredPreRegs = (preRegistrations || []).filter(pr => 
        !q || (pr.businessName && pr.businessName.toLowerCase().includes(q)) || 
        (pr.contactName && pr.contactName.toLowerCase().includes(q)) || 
        (pr.phone && pr.phone.toLowerCase().includes(q)) || 
        (pr.category && pr.category.toLowerCase().includes(q)) || 
        (pr.city && pr.city.toLowerCase().includes(q))
      );

      container.innerHTML = `
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in space-y-6">
          
          <!-- Header del Panel Developer -->
          <div class="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="px-2.5 py-1 bg-amber-500 text-slate-950 text-xs font-black tracking-wider rounded-lg uppercase">
                  SuperAdmin Dev Mode
                </span>
                <span class="text-xs text-slate-400 font-mono">v1.2.0 • Costa Rica</span>
              </div>
              <h1 class="text-2xl sm:text-3xl font-black tracking-tight">Panel de Control Developer</h1>
              <p class="text-sm text-slate-300">Monitoreo global de datos, pre-registros de comercios, clientes y categorías personalizadas.</p>
            </div>

            <div class="flex items-center gap-3">
              <div class="text-right hidden sm:block">
                <span class="text-xs text-slate-400 block font-medium">Sesión activa como</span>
                <span class="text-sm font-bold text-amber-400">${devUser.name || 'Developer Master'}</span>
              </div>
              <button id="dev-logout-view-btn" class="px-4 py-2 bg-white/10 hover:bg-rose-600/80 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2">
                <i class="fas fa-sign-out-alt"></i>
                <span>Salir del Panel</span>
              </button>
            </div>
          </div>

          <!-- Métricas Globales -->
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- Pre-registros Leads -->
            <div class="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs flex items-center gap-4 bg-gradient-to-br from-amber-50/40 to-white">
              <div class="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-xl flex-shrink-0 shadow-xs">
                <i class="fas fa-rocket"></i>
              </div>
              <div>
                <span class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Pre-registros</span>
                <span class="text-2xl font-extrabold text-slate-900">${preRegistrations.length}</span>
              </div>
            </div>

            <!-- Comercios -->
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div class="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl flex-shrink-0">
                <i class="fas fa-store"></i>
              </div>
              <div>
                <span class="text-xs font-bold text-slate-400 uppercase tracking-wider block">Comercios</span>
                <span class="text-2xl font-extrabold text-slate-900">${stats.totalBusinesses || businesses.length}</span>
              </div>
            </div>

            <!-- Clientes -->
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div class="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl flex-shrink-0">
                <i class="fas fa-users"></i>
              </div>
              <div>
                <span class="text-xs font-bold text-slate-400 uppercase tracking-wider block">Clientes Registrados</span>
                <span class="text-2xl font-extrabold text-slate-900">${stats.totalClients || clients.length}</span>
              </div>
            </div>

            <!-- Reservas Globales -->
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl flex-shrink-0">
                <i class="fas fa-calendar-check"></i>
              </div>
              <div>
                <span class="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Reservas</span>
                <span class="text-2xl font-extrabold text-slate-900">${stats.totalAppointments || appointments.length}</span>
              </div>
            </div>
          </div>

          <!-- Navegación por Pestañas + Buscador -->
          <div class="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            
            <div class="p-4 sm:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <!-- Tabs -->
              <div class="flex flex-wrap gap-2">
                <button id="dev-tab-preregistrations" class="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${this.activeDevTab === 'preregistrations' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 hover:bg-slate-100'}">
                  <i class="fas fa-rocket"></i>
                  <span>Pre-registros (${preRegistrations.length})</span>
                  ${preRegistrations.length > 0 ? `<span class="px-2 py-0.5 bg-slate-950 text-amber-400 text-[10px] rounded-full font-black">${preRegistrations.length}</span>` : ''}
                </button>

                <button id="dev-tab-sinpe" class="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${this.activeDevTab === 'sinpe' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}">
                  <i class="fas fa-mobile-alt"></i>
                  <span>Activaciones SINPE (${pendingSinpeBusinesses.length})</span>
                  ${pendingSinpeBusinesses.length > 0 ? `<span class="px-2 py-0.5 bg-amber-400 text-slate-950 text-[10px] rounded-full font-black animate-pulse">${pendingSinpeBusinesses.length}</span>` : ''}
                </button>

                <button id="dev-tab-alerts" class="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${this.activeDevTab === 'alerts' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 hover:bg-slate-100'}">
                  <i class="fas fa-bell"></i>
                  <span>Nuevas Categorías</span>
                  ${pendingAlerts.length > 0 ? `<span class="px-2 py-0.5 bg-slate-950 text-amber-400 text-[10px] rounded-full font-black">${pendingAlerts.length}</span>` : ''}
                </button>

                <button id="dev-tab-businesses" class="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${this.activeDevTab === 'businesses' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}">
                  <i class="fas fa-store"></i>
                  <span>Directorio de Negocios (${businesses.length})</span>
                </button>

                <button id="dev-tab-clients" class="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${this.activeDevTab === 'clients' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}">
                  <i class="fas fa-users"></i>
                  <span>Usuarios / Clientes (${clients.length})</span>
                </button>

                <button id="dev-tab-appointments" class="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${this.activeDevTab === 'appointments' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}">
                  <i class="fas fa-calendar-alt"></i>
                  <span>Reservas Globales (${appointments.length})</span>
                </button>

                <button id="dev-tab-whatsapp" class="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${this.activeDevTab === 'whatsapp' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}">
                  <i class="fab fa-whatsapp ${this.activeDevTab === 'whatsapp' ? 'text-white' : 'text-emerald-600'}"></i>
                  <span>WhatsApp & Meta API</span>
                  ${waSettings.configured ? '<span class="w-2 h-2 rounded-full bg-emerald-400"></span>' : '<span class="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] rounded font-bold">Por Configurar</span>'}
                </button>

                <button id="dev-tab-paypal" class="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${this.activeDevTab === 'paypal' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 hover:bg-slate-100'}">
                  <i class="fab fa-paypal text-blue-600"></i>
                  <span>PayPal & Suscripciones</span>
                  <span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] rounded-full font-bold">Activo</span>
                </button>

                <button id="dev-tab-maintenance" class="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${this.activeDevTab === 'maintenance' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 hover:bg-slate-100'}">
                  <i class="fas fa-broom"></i>
                  <span>Mantenimiento & Exportación</span>
                  ${(cleanupStats.totalPurgeable || 0) > 0 ? `<span class="px-2 py-0.5 bg-rose-500 text-white text-[10px] rounded-full font-black">${cleanupStats.totalPurgeable}</span>` : ''}
                </button>
              </div>

              <!-- Buscador Rápido -->
              <div class="relative w-full md:w-72">
                <i class="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input type="text" id="dev-search-input" value="${this.devSearchQuery || ''}" placeholder="Buscar en esta tabla..." class="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none">
              </div>
            </div>

            <!-- CONTENIDO DE LA PESTAÑA ACTIVA -->
            <div class="p-4 sm:p-6">
              
              <!-- PESTAÑA 0: PRE-REGISTROS DE COMERCIOS (LEADS PRELANZAMIENTO) -->
              ${this.activeDevTab === 'preregistrations' ? `
                <div class="space-y-4">
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 class="text-base font-bold text-slate-800">Comercios Pre-registrados (Acceso Anticipado)</h3>
                      <p class="text-xs text-slate-500">Lista de dueños de negocio inscritos en la etapa de prelanzamiento para contactar vía WhatsApp.</p>
                    </div>
                    <span class="px-3.5 py-1.5 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl text-xs font-black flex items-center gap-1.5 self-start shadow-xs">
                      🎁 15 Días Gratis + Catálogo Asistido
                    </span>
                  </div>

                  ${filteredPreRegs.length === 0 ? `
                    <div class="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100">
                      <i class="fas fa-rocket text-3xl text-amber-500 mb-2"></i>
                      <p class="text-sm font-bold text-slate-700">No hay pre-registros aún</p>
                      <p class="text-xs text-slate-400">Cuando un comercio se inscriba en el banner principal, aparecerá aquí en tiempo real.</p>
                    </div>
                  ` : `
                    <div class="overflow-x-auto">
                      <table class="w-full text-left text-xs text-slate-600">
                        <thead class="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th class="p-3">Comercio / Negocio</th>
                            <th class="p-3">Persona de Contacto</th>
                            <th class="p-3">WhatsApp</th>
                            <th class="p-3">Categoría & Cantón</th>
                            <th class="p-3">Plan de Interés</th>
                            <th class="p-3">Fecha</th>
                            <th class="p-3 text-right">Contacto Directo</th>
                            <th class="p-3">Estado</th>
                            <th class="p-3 text-right">Acciones Developer</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 font-medium">
                          ${filteredPreRegs.map(pr => {
                            const waClean = (pr.phone || '').replace(/\D/g, '');
                            const waUrl = `https://wa.me/506${waClean}?text=${encodeURIComponent('Hola ' + (pr.contactName || '') + ', te saludamos de Reservas CR respecto al pre-registro de tu negocio ' + (pr.businessName || '') + '.')}`;
                            const isPrBlocked = Boolean(pr.isBlocked);
                            return `
                              <tr class="hover:bg-slate-50/80 transition-colors">
                              <tr class="hover:bg-slate-50/80 transition-colors ${isPrBlocked ? 'bg-rose-50/30' : ''}">
                                <td class="p-3">
                                  <strong class="text-slate-900 block font-bold text-sm">${this.escapeHtml(pr.businessName)}</strong>
                                  <span class="text-[10px] text-slate-400 font-mono">${pr.id}</span>
                                </td>
                                <td class="p-3 font-semibold text-slate-700">
                                  <i class="fas fa-user-circle text-slate-400 mr-1"></i> ${this.escapeHtml(pr.contactName || '-')}
                                </td>
                                <td class="p-3">
                                  <a href="${waUrl}" target="_blank" class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-bold hover:bg-emerald-100 transition-colors">
                                    <i class="fab fa-whatsapp text-emerald-600"></i>
                                    <span>+506 ${this.escapeHtml(pr.phone)}</span>
                                  </a>
                                </td>
                                <td class="p-3">
                                  <span class="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 text-[11px] font-bold block w-fit mb-0.5">
                                    ${this.escapeHtml(pr.category || 'Servicios')}
                                  </span>
                                  <span class="text-[10px] text-slate-500">${this.escapeHtml(pr.city || 'Costa Rica')}</span>
                                </td>
                                <td class="p-3">
                                  <span class="px-2.5 py-1 rounded-lg text-xs font-black ${pr.planInterest === 'unlimited' ? 'bg-purple-100 text-purple-800' : (pr.planInterest === 'pro' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800')}">
                                    ${pr.planInterest === 'unlimited' ? 'Plan ∞ ($35)' : (pr.planInterest === 'pro' ? 'Plan Pro ($18)' : 'Plan Básico ($10)')}
                                  </span>
                                </td>
                                <td class="p-3 text-[11px] text-slate-500">
                                  ${new Date(pr.createdAt).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td class="p-3 text-right">
                                  <a href="${waUrl}" target="_blank" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-all">
                                    <i class="fab fa-whatsapp"></i> Chatear
                                  </a>
                                <td class="p-3 whitespace-nowrap">
                                  ${isPrBlocked ? `
                                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200" title="Descartado/Bloqueado: ${this.escapeHtml(pr.blockReason || 'Sin motivo')}">
                                      <i class="fas fa-ban text-rose-600"></i> Descartado
                                    </span>
                                  ` : pr.status === 'contacted' ? `
                                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                      <i class="fas fa-comments text-blue-600"></i> Contactado
                                    </span>
                                  ` : pr.status === 'active' ? `
                                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      <i class="fas fa-check-circle text-emerald-600"></i> Activado
                                    </span>
                                  ` : `
                                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                      <i class="fas fa-clock text-amber-600"></i> Pendiente
                                    </span>
                                  `}
                                </td>
                                <td class="p-3 text-right whitespace-nowrap">
                                  <div class="flex items-center justify-end gap-1.5">
                                    <!-- Modificar / Editar Pre-Registro -->
                                    <button class="dev-edit-prereg-btn px-2.5 py-1.5 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-2xs cursor-pointer" data-id="${pr.id}" data-name="${this.escapeHtml(pr.businessName)}" title="Modificar datos del pre-registro">
                                      <i class="fas fa-edit text-xs"></i>
                                      <span>Modificar</span>
                                    </button>

                                    <!-- Bloquear / Descartar / Reactivar -->
                                    ${isPrBlocked ? `
                                      <button class="dev-toggle-block-prereg-btn px-2.5 py-1.5 bg-rose-100 hover:bg-emerald-100 text-rose-900 hover:text-emerald-900 border border-rose-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer" data-id="${pr.id}" data-action="unblock" data-name="${this.escapeHtml(pr.businessName)}" title="Reactivar pre-registro">
                                        <i class="fas fa-undo text-emerald-600"></i> Reactivar
                                      </button>
                                    ` : `
                                      <button class="dev-toggle-block-prereg-btn px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-800 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer" data-id="${pr.id}" data-action="block" data-name="${this.escapeHtml(pr.businessName)}" title="Descartar o bloquear pre-registro">
                                        <i class="fas fa-ban text-rose-600"></i> Bloquear
                                      </button>
                                    `}

                                    <!-- Eliminar definitivamente -->
                                    <button class="dev-delete-prereg-btn p-2 bg-slate-100 hover:bg-rose-600 hover:text-white text-slate-500 rounded-xl transition-all cursor-pointer" data-id="${pr.id}" data-name="${this.escapeHtml(pr.businessName)}" title="Eliminar pre-registro permanentemente">
                                      <i class="fas fa-trash-alt text-xs"></i>
                                    </button>

                                    <!-- Chatear WhatsApp -->
                                    <a href="${waUrl}" target="_blank" class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1 shadow-xs transition-all" title="Abrir WhatsApp">
                                      <i class="fab fa-whatsapp"></i>
                                      <span class="hidden sm:inline">WhatsApp</span>
                                    </a>
                                  </div>
                                </td>
                              </tr>
                            `;
                          }).join('')}
                        </tbody>
                      </table>
                    </div>
                  `}
                </div>
              ` : ''}

              <!-- PESTAÑA: ACTIVACIONES SINPE MÓVIL -->
              ${this.activeDevTab === 'sinpe' ? `
                <div class="space-y-4">
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 class="text-base font-bold text-slate-800">Comercios Pendientes de Activación por SINPE Móvil</h3>
                      <p class="text-xs text-slate-500">Verifica el comprobante recibido al WhatsApp 7143-3852 y activa el plan del comercio con 1 clic.</p>
                    </div>
                    <span class="px-3.5 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-black flex items-center gap-1.5 self-start shadow-xs">
                      <i class="fas fa-university"></i> SINPE: 7143-3852 (Juan Jose Jiménez)
                    </span>
                  </div>

                  ${filteredSinpeBusinesses.length === 0 ? `
                    <div class="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100">
                      <i class="fas fa-check-circle text-3xl text-emerald-500 mb-2"></i>
                      <p class="text-sm font-bold text-slate-700">¡Al día! No hay comercios pendientes de activación SINPE</p>
                      <p class="text-xs text-slate-400">Cuando un comercio se registre o seleccione pagar con SINPE Móvil, aparecerá en esta lista.</p>
                    </div>
                  ` : `
                    <div class="overflow-x-auto">
                      <table class="w-full text-left text-xs text-slate-600">
                        <thead class="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th class="p-3">Comercio</th>
                            <th class="p-3">Contacto / WhatsApp</th>
                            <th class="p-3">Categoría & Ciudad</th>
                            <th class="p-3">Plan Solicitado</th>
                            <th class="p-3">Seleccionar Plan a Activar</th>
                            <th class="p-3 text-right">Acción</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 font-medium">
                          ${filteredSinpeBusinesses.map(biz => {
                            const waClean = (biz.phone || '').replace(/\D/g, '');
                            const waUrl = `https://wa.me/506${waClean}?text=${encodeURIComponent('Hola ' + (biz.name || '') + ', te contactamos de Reservas CR para confirmar la activación de tu plan por SINPE Móvil.')}`;
                            const currentPlan = biz.plan || 'basic';
                            return `
                              <tr class="hover:bg-slate-50/80 transition-colors bg-amber-50/20">
                                <td class="p-3">
                                  <div class="flex items-center gap-2.5">
                                    <img src="${biz.image || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80'}" class="w-9 h-9 rounded-xl object-cover border border-slate-200">
                                    <div>
                                      <strong class="text-slate-900 block font-bold text-sm">${this.escapeHtml(biz.name)}</strong>
                                      <span class="text-[10px] text-slate-400 font-mono">${biz.id}</span>
                                    </div>
                                  </div>
                                </td>
                                <td class="p-3">
                                  <div class="space-y-1">
                                    <a href="${waUrl}" target="_blank" class="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-bold hover:bg-emerald-100 transition-colors">
                                      <i class="fab fa-whatsapp text-emerald-600"></i>
                                      <span>${this.escapeHtml(biz.phone || '-')}</span>
                                    </a>
                                    <span class="text-[10px] text-slate-400 block">${this.escapeHtml(biz.email || '-')}</span>
                                  </div>
                                </td>
                                <td class="p-3">
                                  <span class="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 text-[11px] font-bold block w-fit mb-0.5">
                                    ${this.escapeHtml(biz.categoryLabel || biz.category || '-')}
                                  </span>
                                  <span class="text-[10px] text-slate-500">${this.escapeHtml(biz.city || 'Costa Rica')}</span>
                                </td>
                                <td class="p-3">
                                  <span class="px-2.5 py-1 rounded-lg text-xs font-black ${currentPlan === 'unlimited' ? 'bg-purple-100 text-purple-800' : (currentPlan === 'pro' ? 'bg-amber-100 text-amber-800' : (currentPlan === 'test' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'))}">
                                    ${currentPlan === 'unlimited' ? 'Ilimitado ($35)' : (currentPlan === 'pro' ? 'Profesional ($18)' : (currentPlan === 'test' ? 'Test 24h ($0.10)' : 'Básico ($10)'))}
                                  </span>
                                </td>
                                <td class="p-3">
                                  <select id="dev-sinpe-plan-select-${biz.id}" class="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                                    <option value="test" ${currentPlan === 'test' ? 'selected' : ''}>Plan Prueba ($0.10 - 24 Horas)</option>
                                    <option value="basic" ${currentPlan === 'basic' ? 'selected' : ''}>Plan Básico ($10/mes - 150 reservas)</option>
                                    <option value="pro" ${currentPlan === 'pro' ? 'selected' : ''}>Plan Profesional ($18/mes - 300 reservas)</option>
                                    <option value="unlimited" ${currentPlan === 'unlimited' ? 'selected' : ''}>Plan Ilimitado ($35/mes - ∞ reservas)</option>
                                  </select>
                                </td>
                                <td class="p-3 text-right">
                                  <button 
                                    class="dev-activate-sinpe-biz-btn px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black inline-flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                                    data-biz-id="${biz.id}"
                                  >
                                    <i class="fas fa-check-circle"></i>
                                    <span>Activar Plan</span>
                                  </button>
                                </td>
                              </tr>
                            `;
                          }).join('')}
                        </tbody>
                      </table>
                    </div>
                  `}
                </div>
              ` : ''}

              <!-- PESTAÑA 1: ALERTAS & NUEVAS CATEGORÍAS -->
              ${this.activeDevTab === 'alerts' ? `
                <div class="space-y-4">
                  <div class="flex items-center justify-between">
                    <div>
                      <h3 class="text-base font-bold text-slate-800">Alertas de Categorías Creadas por Comercios</h3>
                      <p class="text-xs text-slate-500">Notificaciones en tiempo real cuando un comercio escribe una categoría personalizada que no estaba en el catálogo original.</p>
                    </div>
                  </div>

                  ${filteredAlerts.length === 0 ? `
                    <div class="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100">
                      <i class="fas fa-check-double text-3xl text-emerald-500 mb-2"></i>
                      <p class="text-sm font-bold text-slate-700">No hay alertas registradas</p>
                      <p class="text-xs text-slate-400">Cuando un comercio use "Otra Categoría (Personalizada)", aparecerá aquí de inmediato.</p>
                    </div>
                  ` : `
                    <div class="overflow-x-auto">
                      <table class="w-full text-left text-xs text-slate-600">
                        <thead class="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th class="p-3">Estado</th>
                            <th class="p-3">Categoría Creada</th>
                            <th class="p-3">Comercio que la Ingresó</th>
                            <th class="p-3">Fecha y Hora</th>
                            <th class="p-3 text-right">Acción</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 font-medium">
                          ${filteredAlerts.map(a => {
                            const isPending = a.status === 'unread' || a.status === 'pending';
                            const catName = a.categoryName || a.category_name || 'Personalizada';
                            const catId = a.categoryId || a.category_id || '';
                            const bizName = a.businessName || a.business_name || 'Comercio';
                            const bizId = a.businessId || a.business_id || '';
                            const alertDate = a.createdAt || a.created_at;

                            return `
                            <tr class="hover:bg-slate-50/80 transition-colors ${isPending ? 'bg-amber-50/30' : ''}">
                              <td class="p-3">
                                ${isPending ? `
                                  <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                                    <i class="fas fa-clock"></i> Pendiente
                                  </span>
                                ` : `
                                  <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    <i class="fas fa-check"></i> Revisada
                                  </span>
                                `}
                              </td>
                              <td class="p-3">
                                <span class="font-bold text-slate-900 text-sm block">${catName}</span>
                                <span class="text-[10px] text-slate-400 font-mono">ID: ${catId}</span>
                              </td>
                              <td class="p-3">
                                <span class="font-bold text-slate-800 block">${bizName}</span>
                                <span class="text-[10px] text-slate-400">Biz ID: ${bizId}</span>
                              </td>
                              <td class="p-3 text-slate-500 whitespace-nowrap">
                                ${alertDate ? new Date(alertDate).toLocaleString('es-CR') : 'Reciente'}
                              </td>
                              <td class="p-3 text-right">
                                ${isPending ? `
                                  <button class="dismiss-alert-btn px-3 py-1.5 bg-slate-900 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all shadow-xs" data-id="${a.id}">
                                    <i class="fas fa-check mr-1"></i> Marcar Revisada
                                  </button>
                                ` : `
                                  <span class="text-xs text-slate-400 font-medium">Aprobada</span>
                                `}
                              </td>
                            </tr>
                          `}).join('')}
                        </tbody>
                      </table>
                    </div>
                  `}
                </div>
              ` : ''}

              <!-- PESTAÑA 2: DIRECTORIO DE NEGOCIOS -->
              ${this.activeDevTab === 'businesses' ? `
                <div class="space-y-4">
                  <div class="flex items-center justify-between">
                <div class="space-y-5">
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 class="text-base font-bold text-slate-800">Directorio General de Comercios</h3>
                      <p class="text-xs text-slate-500">Listado completo de comercios de muestra y registrados con contacto de dueños.</p>
                      <h3 class="text-base font-bold text-slate-900">Directorio General de Comercios</h3>
                      <p class="text-xs text-slate-500">Administra todos los comercios: ocúltalos de la página de inicio, bloquéalos o elimínalos.</p>
                    </div>

                    <!-- Mini resumen en badges -->
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs">
                        <i class="fas fa-check-circle text-emerald-600"></i> ${activeBusinessesCount} Activos
                      </span>
                      <span class="px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs">
                        <i class="fas fa-eye-slash text-amber-600"></i> ${hiddenBusinessesCount} Ocultos
                      </span>
                      <span class="px-3 py-1.5 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs">
                        <i class="fas fa-ban text-rose-600"></i> ${blockedBusinessesCount} Bloqueados
                      </span>
                    </div>
                  </div>

                  <!-- Chips de filtrado rápido por estado/tipo -->
                  <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                    <button class="dev-biz-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${this.devBizFilter === 'all' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}" data-filter="all">
                      Todos (${businesses.length})
                    </button>
                    <button class="dev-biz-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${this.devBizFilter === 'active' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}" data-filter="active">
                      <i class="fas fa-check-circle mr-1"></i> Activos (${activeBusinessesCount})
                    </button>
                    <button class="dev-biz-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${this.devBizFilter === 'hidden' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}" data-filter="hidden">
                      <i class="fas fa-eye-slash mr-1"></i> Ocultos en Inicio (${hiddenBusinessesCount})
                    </button>
                    <button class="dev-biz-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${this.devBizFilter === 'blocked' ? 'bg-rose-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}" data-filter="blocked">
                      <i class="fas fa-ban mr-1"></i> Bloqueados (${blockedBusinessesCount})
                    </button>
                    <button class="dev-biz-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${this.devBizFilter === 'real' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}" data-filter="real">
                      Registrados Reales (${realBusinessesCount})
                    </button>
                    <button class="dev-biz-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${this.devBizFilter === 'demo' ? 'bg-purple-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}" data-filter="demo">
                      Muestra (${demoBusinessesCount})
                    </button>
                  </div>

                  ${filteredBusinesses.length === 0 ? `
                    <div class="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100 text-slate-400">
                      <i class="fas fa-store-slash text-3xl mb-2"></i>
                      <p class="text-sm font-bold text-slate-700">No se encontraron comercios con esa búsqueda</p>
                      <p class="text-sm font-bold text-slate-700">No se encontraron comercios en esta categoría o búsqueda</p>
                    </div>
                  ` : `
                    <div class="overflow-x-auto">
                      <table class="w-full text-left text-xs text-slate-600">
                        <thead class="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th class="p-3">Comercio</th>
                            <th class="p-3">Categoría</th>
                            <th class="p-3">Plan Activo</th>
                            <th class="p-3">Ubicación / Contacto</th>
                            <th class="p-3">Dueño / Correo</th>
                            <th class="p-3">Servicios</th>
                            <th class="p-3">Estado</th>
                            <th class="p-3">Tipo</th>
                            <th class="p-3 text-right">Acciones Developer</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 font-medium">
                          ${filteredBusinesses.map(b => `
                            <tr class="hover:bg-slate-50/80 transition-colors ${b.isBlocked ? 'bg-rose-50/30' : b.isHidden ? 'bg-amber-50/30' : ''}">
                              <td class="p-3">
                                <div class="flex items-center gap-3">
                                  <img src="${b.image || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80'}" alt="${b.name}" class="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-xs flex-shrink-0">
                                  <div>
                                    <span class="font-bold text-slate-900 block text-sm">${b.name}</span>
                                    <span class="text-[10px] text-slate-400 font-mono">ID: ${b.id}</span>
                                  </div>
                                </div>
                              </td>
                              <td class="p-3">
                                <span class="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-semibold text-[11px] block whitespace-nowrap">${b.categoryLabel || b.category}</span>
                              </td>
                              <td class="p-3 whitespace-nowrap">
                                <select 
                                  class="dev-change-plan-select text-xs font-bold px-2.5 py-1.5 rounded-xl border cursor-pointer transition-all shadow-2xs focus:ring-2 focus:ring-indigo-500 focus:outline-none ${b.plan === 'unlimited' ? 'bg-purple-100 text-purple-900 border-purple-300' : b.plan === 'pro' ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-blue-50 text-blue-900 border-blue-200'}" 
                                  data-id="${b.id}" 
                                  data-name="${b.name}"
                                >
                                  <option value="basic" ${b.plan === 'basic' ? 'selected' : ''}>🔹 Básico ($8 • 150)</option>
                                  <option value="pro" ${b.plan === 'pro' ? 'selected' : ''}>⭐ Pro ($15 • 300)</option>
                                  <option value="unlimited" ${b.plan === 'unlimited' ? 'selected' : ''}>🚀 Ilimitado ($25 • ∞)</option>
                                </select>
                              </td>
                              <td class="p-3">
                                <span class="block text-slate-800 font-semibold">${b.city || 'Costa Rica'}</span>
                                <span class="text-[10px] text-slate-400">${b.phone || 'Sin teléfono'}</span>
                              </td>
                              <td class="p-3">
                                <span class="block text-slate-800">${b.ownerName || (b.isDemo ? 'Demo Admin' : 'Registrado')}</span>
                                <span class="text-[10px] text-slate-400">${b.ownerEmail || b.email || 'N/A'}</span>
                              </td>
                              <td class="p-3">
                                <span class="font-bold text-slate-800">${b.servicesCount !== undefined ? b.servicesCount : (b.services ? b.services.length : 0)} servicios</span>
                              </td>
                              <td class="p-3 whitespace-nowrap">
                                ${b.isBlocked ? `
                                  <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200" title="Suspendido: ${b.blockReason || 'Sin motivo'}">
                                    <i class="fas fa-ban text-rose-600"></i> Bloqueado
                                  </span>
                                ` : b.isHidden ? `
                                  <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200" title="No aparece en la página principal">
                                    <i class="fas fa-eye-slash text-amber-600"></i> Oculto en Inicio
                                  </span>
                                ` : `
                                  <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200" title="Visible y aceptando reservas">
                                    <i class="fas fa-check-circle text-emerald-600"></i> Activo & Visible
                                  </span>
                                `}
                              </td>
                              <td class="p-3 whitespace-nowrap">
                                ${b.isDemo ? `
                                  <span class="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded">Muestra</span>
                                ` : `
                                  <span class="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded">Real</span>
                                `}
                              </td>
                              <td class="p-3 text-right whitespace-nowrap">
                                <div class="flex items-center justify-end gap-1.5">
                                  <!-- Ver en Directorio -->
                                  <button class="dev-view-biz-btn p-2 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-xl transition-all" data-id="${b.id}" title="Ver página del comercio">
                                    <i class="fas fa-external-link-alt text-xs"></i>
                                  </button>

                                  <!-- Modificar / Editar Negocio -->
                                  <button class="dev-edit-biz-btn px-2.5 py-1.5 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-2xs cursor-pointer" data-id="${b.id}" data-name="${b.name}" title="Modificar datos completos del negocio">
                                    <i class="fas fa-edit text-xs"></i>
                                    <span>Modificar</span>
                                  </button>

                                  <!-- Ocultar / Mostrar en Inicio -->
                                  ${b.isHidden ? `
                                    <button class="dev-toggle-visibility-btn px-2.5 py-1.5 bg-amber-100 hover:bg-emerald-100 text-amber-900 hover:text-emerald-900 border border-amber-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-xs" data-id="${b.id}" data-action="show" data-name="${b.name}" title="Hacer visible en la página principal">
                                      <i class="fas fa-eye text-emerald-600"></i> Mostrar
                                    </button>
                                  ` : `
                                    <button class="dev-toggle-visibility-btn px-2.5 py-1.5 bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1" data-id="${b.id}" data-action="hide" data-name="${b.name}" title="Ocultar de la página principal">
                                      <i class="fas fa-eye-slash text-amber-600"></i> Ocultar
                                    </button>
                                  `}

                                  <!-- Bloquear / Desbloquear -->
                                  ${b.isBlocked ? `
                                    <button class="dev-toggle-block-btn px-2.5 py-1.5 bg-rose-100 hover:bg-emerald-100 text-rose-900 hover:text-emerald-900 border border-rose-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-xs" data-id="${b.id}" data-action="unblock" data-name="${b.name}" title="Desbloquear este comercio">
                                      <i class="fas fa-unlock text-emerald-600"></i> Desbloquear
                                    </button>
                                  ` : `
                                    <button class="dev-toggle-block-btn px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-800 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1" data-id="${b.id}" data-action="block" data-name="${b.name}" title="Bloquear / Suspender reservas">
                                      <i class="fas fa-ban text-rose-600"></i> Bloquear
                                    </button>
                                  `}

                                  <!-- Eliminar definitivamente -->
                                  <button class="dev-delete-biz-btn p-2 bg-slate-100 hover:bg-rose-600 hover:text-white text-slate-500 rounded-xl transition-all" data-id="${b.id}" data-name="${b.name}" title="Eliminar Comercio Permanentemente">
                                    <i class="fas fa-trash-alt text-xs"></i>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                    </div>
                  `}
                </div>
              ` : ''}

              <!-- PESTAÑA 3: USUARIOS / CLIENTES -->
              ${this.activeDevTab === 'clients' ? `
                <div class="space-y-4">
                  <div class="flex items-center justify-between">
                    <div>
                      <h3 class="text-base font-bold text-slate-800">Clientes Registrados en la Plataforma</h3>
                      <p class="text-xs text-slate-500">Usuarios finales registrados para realizar reservas.</p>
                    </div>
                  </div>

                  ${filteredClients.length === 0 ? `
                    <div class="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100 text-slate-400">
                      <i class="fas fa-user-slash text-3xl mb-2"></i>
                      <p class="text-sm font-bold text-slate-700">No hay clientes registrados aún</p>
                    </div>
                  ` : `
                    <div class="overflow-x-auto">
                      <table class="w-full text-left text-xs text-slate-600">
                        <thead class="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th class="p-3">Nombre</th>
                            <th class="p-3">Teléfono / WhatsApp</th>
                            <th class="p-3">Correo Electrónico</th>
                            <th class="p-3">Fecha de Registro</th>
                            <th class="p-3">Total Reservas</th>
                            <th class="p-3">Estado</th>
                            <th class="p-3 text-right">Acciones Developer</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 font-medium">
                          ${filteredClients.map(c => {
                            const regDate = c.createdAt || c.created_at;
                            const count = c.appointmentsCount !== undefined ? c.appointmentsCount : (c.booking_count || 0);
                            const isCliBlocked = Boolean(c.isBlocked);

                            return `
                            <tr class="hover:bg-slate-50/80 transition-colors ${isCliBlocked ? 'bg-rose-50/30' : ''}">
                              <td class="p-3">
                                <div class="flex items-center gap-2">
                                  <div class="w-7 h-7 rounded-full ${isCliBlocked ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'} font-bold flex items-center justify-center text-xs">
                                    ${c.name ? c.name.charAt(0).toUpperCase() : 'U'}
                                  </div>
                                  <div>
                                    <span class="font-bold text-slate-900 block">${c.name}</span>
                                    <span class="text-[10px] text-slate-400 font-mono">ID: ${c.id}</span>
                                  </div>
                                </div>
                              </td>
                              <td class="p-3">
                                <span class="font-semibold text-slate-800">${c.phone || 'N/A'}</span>
                              </td>
                              <td class="p-3">
                                <span class="text-slate-600">${c.email || 'Sin correo'}</span>
                              </td>
                              <td class="p-3 text-slate-500 whitespace-nowrap">
                                ${regDate ? new Date(regDate).toLocaleDateString('es-CR') : 'N/A'}
                              </td>
                              <td class="p-3">
                                <span class="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-bold text-xs">${count}</span>
                              </td>
                              <td class="p-3 whitespace-nowrap">
                                ${isCliBlocked ? `
                                  <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200" title="Suspendido: ${this.escapeHtml(c.blockReason || 'Sin motivo')}">
                                    <i class="fas fa-ban text-rose-600"></i> Bloqueado
                                  </span>
                                ` : `
                                  <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <i class="fas fa-check-circle text-emerald-600"></i> Activo
                                  </span>
                                `}
                              </td>
                              <td class="p-3 text-right whitespace-nowrap">
                                <div class="flex items-center justify-end gap-1.5">
                                  <!-- Modificar / Editar Cliente -->
                                  <button class="dev-edit-client-btn px-2.5 py-1.5 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-2xs cursor-pointer" data-id="${c.id}" data-name="${this.escapeHtml(c.name)}" title="Modificar datos del cliente">
                                    <i class="fas fa-edit text-xs"></i>
                                    <span>Modificar</span>
                                  </button>

                                  <!-- Bloquear / Desbloquear Cliente -->
                                  ${isCliBlocked ? `
                                    <button class="dev-toggle-block-client-btn px-2.5 py-1.5 bg-rose-100 hover:bg-emerald-100 text-rose-900 hover:text-emerald-900 border border-rose-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer" data-id="${c.id}" data-action="unblock" data-name="${this.escapeHtml(c.name)}" title="Desbloquear este cliente">
                                      <i class="fas fa-unlock text-emerald-600"></i> Desbloquear
                                    </button>
                                  ` : `
                                    <button class="dev-toggle-block-client-btn px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-800 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer" data-id="${c.id}" data-action="block" data-name="${this.escapeHtml(c.name)}" title="Bloquear / Suspender cliente">
                                      <i class="fas fa-ban text-rose-600"></i> Bloquear
                                    </button>
                                  `}

                                  <!-- Eliminar definitivamente -->
                                  <button class="dev-delete-client-btn p-2 bg-slate-100 hover:bg-rose-600 hover:text-white text-slate-500 rounded-xl transition-all cursor-pointer" data-id="${c.id}" data-name="${this.escapeHtml(c.name)}" title="Eliminar cliente permanentemente">
                                    <i class="fas fa-trash-alt text-xs"></i>
                                  </button>
                                </div>
                              </td>
                            </tr>
                            `;
                          }).join('')}
                        </tbody>
                      </table>
                    </div>
                  `}
                </div>
              ` : ''}

              <!-- PESTAÑA 4: HISTORIAL DE RESERVAS GLOBALES -->
              ${this.activeDevTab === 'appointments' ? `
                <div class="space-y-4">
                  <div class="flex items-center justify-between">
                    <div>
                      <h3 class="text-base font-bold text-slate-800">Reservas Globales Agendadas</h3>
                      <p class="text-xs text-slate-500">Historial en vivo de todas las reservas agendadas entre clientes y comercios.</p>
                    </div>
                  </div>

                  ${filteredAppointments.length === 0 ? `
                    <div class="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100 text-slate-400">
                      <i class="fas fa-calendar-times text-3xl mb-2"></i>
                      <p class="text-sm font-bold text-slate-700">No hay reservas registradas en el sistema</p>
                    </div>
                  ` : `
                    <div class="overflow-x-auto">
                      <table class="w-full text-left text-xs text-slate-600">
                        <thead class="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th class="p-3">Cliente</th>
                            <th class="p-3">Comercio</th>
                            <th class="p-3">Servicio</th>
                            <th class="p-3">Fecha & Hora</th>
                            <th class="p-3">Monto</th>
                            <th class="p-3">Estado</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 font-medium">
                          ${filteredAppointments.map(a => {
                            const cliName = a.clientName || a.client_name || 'Cliente';
                            const cliPhone = a.clientPhone || a.client_phone || '';
                            const bizName = a.businessName || a.business_name || 'Comercio';
                            const srvName = a.serviceName || a.service_name || 'Servicio';
                            const price = a.servicePrice !== undefined ? a.servicePrice : (a.price || a.service_price || 0);

                            return `
                            <tr class="hover:bg-slate-50/80 transition-colors">
                              <td class="p-3">
                                <span class="font-bold text-slate-900 block">${cliName}</span>
                                <span class="text-[10px] text-slate-400">${cliPhone}</span>
                              </td>
                              <td class="p-3">
                                <span class="font-bold text-slate-800 block">${bizName}</span>
                              </td>
                              <td class="p-3">
                                <span class="text-slate-800 font-medium block">${srvName}</span>
                              </td>
                              <td class="p-3 whitespace-nowrap">
                                <span class="font-bold text-slate-800 block">${this.formatDateDMY(a.date)}</span>
                                <span class="text-[10px] text-blue-600 font-bold">${this.formatTime12h(a.time)}</span>
                              </td>
                              <td class="p-3 font-bold text-slate-900">
                                ${this.formatColones(price)}
                              </td>
                              <td class="p-3">
                                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${
                                  a.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' :
                                  a.status === 'cancelled' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                                }">
                                  ${a.status === 'confirmed' ? 'Confirmada' : a.status === 'cancelled' ? 'Cancelada' : 'Pendiente'}
                                </span>
                              </td>
                            </tr>
                          `}).join('')}
                        </tbody>
                      </table>
                    </div>
                  `}
                </div>
              ` : ''}

              <!-- PESTAÑA 5: WHATSAPP & META CLOUD API -->
              ${this.activeDevTab === 'whatsapp' ? `
                <div class="space-y-6">
                  <!-- Header informativo -->
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 rounded-2xl text-white border border-emerald-500/30 shadow-md">
                    <div class="space-y-1">
                      <div class="flex items-center gap-2">
                        <span class="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg">
                          <i class="fab fa-whatsapp"></i>
                        </span>
                        <h3 class="text-lg font-black tracking-tight">Meta WhatsApp Cloud API (Oficial Directa)</h3>
                      </div>
                      <p class="text-xs text-slate-300">
                        Conexión oficial directa con los servidores de Meta Graph API. Incluye <strong>1.000 conversaciones gratis al mes</strong> sin intermediarios.
                      </p>
                    </div>

                    <div class="flex items-center gap-2">
                      <span class="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${waSettings.configured ? 'bg-emerald-500 text-slate-950' : 'bg-amber-500 text-slate-950'}">
                        <i class="fas ${waSettings.configured ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i>
                        <span>${waSettings.configured ? 'Conexión Directa Activa' : 'Faltan Credenciales'}</span>
                      </span>
                    </div>
                  </div>

                  <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <!-- Formulario de Credenciales (Guardar en Neon DB) -->
                    <div class="lg:col-span-7 bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                      <div>
                        <h4 class="text-sm font-black text-slate-900 flex items-center gap-2">
                          <i class="fas fa-key text-blue-600"></i>
                          <span>Configuración de Credenciales de Meta</span>
                        </h4>
                        <p class="text-xs text-slate-500 mt-0.5">
                          Al guardar aquí, se actualizan al instante en la base de datos PostgreSQL sin necesidad de reiniciar Render.
                        </p>
                      </div>

                      <form id="dev-save-wa-form" class="space-y-3.5 text-xs">
                        <div>
                          <label class="block font-bold text-slate-700 mb-1">
                            Token de Acceso de Meta (META_WHATSAPP_TOKEN) *
                          </label>
                          <div class="relative">
                            <input 
                              type="password" 
                              id="dev-wa-token" 
                              placeholder="${waSettings.hasToken ? 'Token configurado (' + waSettings.tokenMasked + ')' : 'Pega tu token EAA...'}" 
                              class="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            >
                            <button type="button" id="dev-wa-token-toggle" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                              <i class="fas fa-eye"></i>
                            </button>
                          </div>
                          <span class="text-[10px] text-slate-400 block mt-1">Copiado desde Meta for Developers > WhatsApp > API Setup</span>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label class="block font-bold text-slate-700 mb-1">
                              Identificador del Teléfono (Phone Number ID) *
                            </label>
                            <input 
                              type="text" 
                              id="dev-wa-phone-id" 
                              value="${waSettings.phoneNumberId || ''}" 
                              placeholder="Ej. 109283746501928" 
                              class="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            >
                          </div>
                          <div>
                            <label class="block font-bold text-slate-700 mb-1">
                              WABA ID (WhatsApp Business Account)
                            </label>
                            <input 
                              type="text" 
                              id="dev-wa-waba-id" 
                              value="${waSettings.wabaId || ''}" 
                              placeholder="Ej. 102938475610293" 
                              class="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            >
                          </div>
                        </div>

                        <div class="pt-2">
                          <button 
                            type="submit" 
                            id="dev-save-wa-btn" 
                            class="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <i class="fas fa-save"></i>
                            <span>Guardar Credenciales en Base de Datos</span>
                          </button>
                        </div>
                      </form>
                    </div>

                    <!-- Panel de Prueba en Vivo -->
                    <div class="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
                      <div class="space-y-3">
                        <div class="flex items-center gap-2 text-emerald-600">
                          <i class="fas fa-paper-plane"></i>
                          <h4 class="text-sm font-black text-slate-900">Probar Envío de WhatsApp en Vivo</h4>
                        </div>
                        <p class="text-xs text-slate-500">
                          Envía una notificación real de confirmación de reserva directamente a tu celular.
                        </p>

                        <div class="space-y-2">
                          <label class="block font-bold text-slate-700 text-xs">Teléfono de Prueba (Costa Rica o Internacional):</label>
                          <div class="flex gap-2">
                            <input 
                              type="text" 
                              id="dev-test-phone-input" 
                              value="62297240" 
                              placeholder="Ej. 62297240 o +50662297240" 
                              class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            >
                            <button 
                              type="button" 
                              id="dev-send-test-wa-btn" 
                              class="px-4 py-2.5 bg-slate-900 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all flex-shrink-0 cursor-pointer"
                            >
                              <i class="fas fa-play text-[10px]"></i>
                              <span>Enviar Test</span>
                            </button>
                          </div>
                        </div>

                        <!-- Consola de Resultados en Vivo -->
                        <div id="dev-wa-test-result-box" class="p-3.5 bg-slate-900 rounded-xl text-slate-200 font-mono text-[11px] min-h-[90px] max-h-[160px] overflow-y-auto space-y-1">
                          <span class="text-slate-400 block text-[10px]">// Consola de Diagnóstico Meta API:</span>
                          <span id="dev-wa-test-result-text" class="text-slate-400">Listo para enviar prueba...</span>
                        </div>
                      </div>

                      <div class="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 space-y-1">
                        <span class="font-bold flex items-center gap-1">
                          <i class="fas fa-info-circle"></i> Nota sobre Modo Prueba de Meta:
                        </span>
                        <p class="text-[10px] text-amber-800">
                          Recuerda que en el modo de prueba de Meta, tu número debe estar agregado en el selector "Para:" (To) de la pantalla de Meta for Developers.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ` : ''}

              <!-- PESTAÑA 6: PAYPAL & PAGOS DE SUSCRIPCIÓN -->
              ${this.activeDevTab === 'paypal' ? `
                <div class="space-y-6">
                  <!-- Header de la Pestaña -->
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl border border-indigo-900/50">
                    <div>
                      <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-[11px] font-bold uppercase tracking-wider mb-2 border border-amber-400/30">
                        <i class="fab fa-paypal text-blue-400"></i> Pasarela de Suscripciones Mensuales
                      </div>
                      <h3 class="text-lg font-black">Configuración de PayPal API & Planes</h3>
                      <p class="text-xs text-slate-300 mt-0.5">Control de cobros recurrentes de $8, $15 y $25 para los comercios de Costa Rica.</p>
                    </div>

                    <div class="flex items-center gap-2">
                      <span class="px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs ${paypalConfig.env === 'live' ? 'bg-emerald-500 text-slate-950' : 'bg-amber-400 text-slate-950'}">
                        <i class="fas ${paypalConfig.env === 'live' ? 'fa-check-circle' : 'fa-flask'}"></i>
                        <span>Modo: ${paypalConfig.env === 'live' ? 'PRODUCCIÓN (LIVE)' : 'PRUEBAS (SANDBOX)'}</span>
                      </span>
                    </div>
                  </div>

                  <!-- Resumen de los 3 Planes Activos en PayPal -->
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2">
                      <div class="flex items-center justify-between">
                        <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Plan Básico</span>
                        <span class="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px] font-black">$10 USD / mes</span>
                      </div>
                      <span class="text-xs font-mono font-bold text-slate-800 block truncate" title="${paypalConfig.plans?.basic || ''}">
                        ID: ${paypalConfig.plans?.basic || 'Sin ID'}
                      </span>
                      <span class="text-[11px] text-slate-500 block">Hasta 150 reservas mensuales</span>
                    </div>

                    <div class="p-4 bg-white border-2 border-amber-400 rounded-2xl shadow-xs space-y-2 ring-2 ring-amber-400/20">
                      <div class="flex items-center justify-between">
                        <span class="text-xs font-black text-amber-900 uppercase tracking-wider">Plan Profesional ⭐</span>
                        <span class="px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 text-[10px] font-black">$18 USD / mes</span>
                      </div>
                      <span class="text-xs font-mono font-bold text-slate-800 block truncate" title="${paypalConfig.plans?.pro || ''}">
                        ID: ${paypalConfig.plans?.pro || 'Sin ID'}
                      </span>
                      <span class="text-[11px] text-slate-500 block">Hasta 300 reservas y WhatsApp</span>
                    </div>

                    <div class="p-4 bg-white border border-purple-200 rounded-2xl shadow-xs space-y-2 bg-purple-50/20">
                      <div class="flex items-center justify-between">
                        <span class="text-xs font-bold text-purple-900 uppercase tracking-wider">Plan Ilimitado</span>
                        <span class="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px] font-black">$35 USD / mes</span>
                      </div>
                      <span class="text-xs font-mono font-bold text-slate-800 block truncate" title="${paypalConfig.plans?.unlimited || ''}">
                        ID: ${paypalConfig.plans?.unlimited || 'Sin ID'}
                      </span>
                      <span class="text-[11px] text-slate-500 block">Reservas ilimitadas</span>
                    </div>
                  </div>

                  <!-- Formulario de Configuración y Diagnóstico -->
                  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <!-- Formulario de Credenciales -->
                    <div class="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
                      <h4 class="text-sm font-black text-slate-900 flex items-center gap-2">
                        <i class="fas fa-key text-amber-500"></i> Credenciales de la API de PayPal
                      </h4>

                      <form id="dev-paypal-settings-form" class="space-y-3.5 text-xs">
                        <div>
                          <label class="block font-bold text-slate-700 mb-1">Entorno de Operación</label>
                          <select id="dev-paypal-env" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none">
                            <option value="sandbox" ${paypalConfig.env === 'sandbox' ? 'selected' : ''}>Sandbox (Pruebas con dinero ficticio)</option>
                            <option value="live" ${paypalConfig.env === 'live' ? 'selected' : ''}>Live (Producción con dinero real)</option>
                          </select>
                        </div>

                        <div>
                          <label class="block font-bold text-slate-700 mb-1">Client ID</label>
                          <input type="text" id="dev-paypal-client-id" value="${this.escapeHtml(paypalConfig.clientId || '')}" required class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] focus:ring-2 focus:ring-blue-500 focus:outline-none">
                        </div>

                        <div>
                          <label class="block font-bold text-slate-700 mb-1">Client Secret</label>
                          <input type="password" id="dev-paypal-client-secret" placeholder="••••••••••••••••••••••••••••••••" value="ECkYk7RbWEG2ok9w2Kx5SCGPHwnFegU4I8y3Jv-e-YXWR8wx6jYwXFCBSSMeICkmO2rTVFLAwDXmW6P6" required class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] focus:ring-2 focus:ring-blue-500 focus:outline-none">
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                          <div>
                            <label class="block font-bold text-slate-700 mb-1 text-[10px]">ID Plan Básico ($10)</label>
                            <input type="text" id="dev-paypal-plan-basic" value="${this.escapeHtml(paypalConfig.plans?.basic || '')}" class="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[10px]">
                          </div>
                          <div>
                            <label class="block font-bold text-slate-700 mb-1 text-[10px]">ID Plan Pro ($18)</label>
                            <input type="text" id="dev-paypal-plan-pro" value="${this.escapeHtml(paypalConfig.plans?.pro || '')}" class="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[10px]">
                          </div>
                          <div>
                            <label class="block font-bold text-slate-700 mb-1 text-[10px]">ID Plan ∞ ($35)</label>
                            <input type="text" id="dev-paypal-plan-unlimited" value="${this.escapeHtml(paypalConfig.plans?.unlimited || '')}" class="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[10px]">
                          </div>
                        </div>

                        <div id="dev-paypal-save-msg" class="hidden p-3 rounded-xl text-xs font-semibold"></div>

                        <button type="submit" id="dev-save-paypal-btn" class="w-full py-3 bg-slate-900 hover:bg-blue-600 text-white font-black rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer">
                          <i class="fas fa-save"></i>
                          <span>Guardar Ajustes de PayPal</span>
                        </button>
                      </form>
                    </div>

                    <!-- Diagnóstico y Sincronización Automática -->
                    <div class="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4 flex flex-col justify-between">
                      <div class="space-y-3">
                        <h4 class="text-sm font-black text-slate-900 flex items-center gap-2">
                          <i class="fas fa-sync-alt text-blue-600"></i> Auto-Crear / Sincronizar Planes en PayPal
                        </h4>
                        <p class="text-xs text-slate-500 leading-relaxed">
                          Si cambiaste de cuenta de PayPal o de Sandbox a Live, este botón crea automáticamente el catálogo de producto y los 3 planes mensuales en la API de PayPal y guarda los IDs en tu base de datos al instante.
                        </p>

                        <button type="button" id="dev-sync-paypal-plans-btn" class="w-full py-3 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 text-slate-950 font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer">
                          <i class="fas fa-magic"></i>
                          <span>Sincronizar y Crear Planes en PayPal</span>
                        </button>

                        <!-- Consola de Resultados -->
                        <div id="dev-paypal-sync-console" class="p-3.5 bg-slate-950 rounded-xl text-slate-200 font-mono text-[11px] min-h-[110px] max-h-[180px] overflow-y-auto space-y-1">
                          <span class="text-slate-400 block text-[10px]">// Consola de Diagnóstico PayPal:</span>
                          <span id="dev-paypal-console-text" class="text-slate-400">Listo para operar. Planes activos: Básico ($8), Pro ($15), Ilimitado ($25).</span>
                        </div>
                      </div>

                      <div class="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] text-emerald-950 space-y-1">
                        <span class="font-bold flex items-center gap-1">
                          <i class="fas fa-shield-alt text-emerald-600"></i> Webhook de PayPal URL:
                        </span>
                        <code class="text-[10px] bg-white px-2 py-0.5 rounded border border-emerald-300 block font-mono text-emerald-900 break-all">
                          https://tu-dominio.com/api/webhooks/paypal
                        </code>
                      </div>
                    </div>
                  </div>
                </div>
              ` : ''}

              <!-- PESTAÑA 8: MANTENIMIENTO DE BASE DE DATOS Y EXPORTACIÓN A EXCEL -->
              ${this.activeDevTab === 'maintenance' ? `
                <div class="space-y-8 animate-fade-in">
                  
                  <!-- SECCIÓN 1: DEPURACIÓN DE BASE DE DATOS -->
                  <div class="bg-slate-50/70 rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
                    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                      <div>
                        <div class="flex items-center gap-2">
                          <span class="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-sm">
                            <i class="fas fa-trash-alt"></i>
                          </span>
                          <h3 class="text-lg font-black text-slate-900">Depuración y Limpieza de Base de Datos</h3>
                        </div>
                        <p class="text-xs text-slate-500 mt-1">
                          Selecciona con las casillas de verificación únicamente los datos temporales o expirados que deseas depurar para optimizar el rendimiento.
                        </p>
                      </div>
                      
                      <div class="flex items-center gap-2">
                        <button type="button" id="dev-select-all-cleanup-btn" class="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 transition-all shadow-2xs cursor-pointer">
                          <i class="fas fa-check-square mr-1 text-blue-600"></i> Seleccionar Todo
                        </button>
                        <button type="button" id="dev-clear-all-cleanup-btn" class="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 transition-all shadow-2xs cursor-pointer">
                          <i class="fas fa-square mr-1 text-slate-400"></i> Deseleccionar
                        </button>
                      </div>
                    </div>

                    <!-- Mensaje de Seguridad / Datos Esenciales Protegidos -->
                    <div class="p-3.5 bg-emerald-50/80 rounded-2xl border border-emerald-200/80 text-emerald-900 text-xs flex items-start gap-3">
                      <i class="fas fa-shield-alt text-emerald-600 text-base mt-0.5 flex-shrink-0"></i>
                      <div class="space-y-0.5">
                        <span class="font-bold block">Protección de Datos Esenciales Activada</span>
                        <p class="text-[11px] text-emerald-800 leading-relaxed">
                          Tus comercios registrados, clientes, servicios, reseñas y citas activas o confirmadas <strong>nunca</strong> serán eliminados. Solo se purgarán los elementos seleccionados que cumplan estrictamente con las condiciones de expiración.
                        </p>
                      </div>
                    </div>

                    <!-- Formulario de Opciones de Limpieza -->
                    <form id="dev-cleanup-form" class="space-y-4">
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        
                        <!-- Opción 1: Códigos OTP -->
                        <label class="relative flex items-start p-4 bg-white rounded-2xl border-2 transition-all cursor-pointer select-none group border-slate-200 hover:border-amber-400">
                          <div class="flex items-center h-5 mr-3 mt-0.5">
                            <input type="checkbox" name="cleanup_option" value="otp" class="dev-cleanup-checkbox w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer">
                          </div>
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between gap-2">
                              <span class="text-xs font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                                Códigos OTP de Contraseñas Expirados
                              </span>
                              <span class="px-2 py-0.5 rounded-full text-[11px] font-black ${cleanupStats.expiredOtpCodes > 0 ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-400'}">
                                ${cleanupStats.expiredOtpCodes || 0}
                              </span>
                            </div>
                            <p class="text-[11px] text-slate-500 mt-1 leading-snug">
                              Tokens temporales de 6 dígitos que ya caducaron (>15 min) o que ya fueron usados para restablecer contraseña.
                            </p>
                          </div>
                        </label>

                        <!-- Opción 2: Bloqueos Pasados -->
                        <label class="relative flex items-start p-4 bg-white rounded-2xl border-2 transition-all cursor-pointer select-none group border-slate-200 hover:border-amber-400">
                          <div class="flex items-center h-5 mr-3 mt-0.5">
                            <input type="checkbox" name="cleanup_option" value="date_blocks" class="dev-cleanup-checkbox w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer">
                          </div>
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between gap-2">
                              <span class="text-xs font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                                Bloqueos de Fechas Pasadas
                              </span>
                              <span class="px-2 py-0.5 rounded-full text-[11px] font-black ${cleanupStats.pastDateBlocks > 0 ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-400'}">
                                ${cleanupStats.pastDateBlocks || 0}
                              </span>
                            </div>
                            <p class="text-[11px] text-slate-500 mt-1 leading-snug">
                              Días no laborales o feriados configurados por comercios cuya fecha es anterior al día de hoy.
                            </p>
                          </div>
                        </label>

                        <!-- Opción 3: Alertas de Categorías Antiguas -->
                        <label class="relative flex items-start p-4 bg-white rounded-2xl border-2 transition-all cursor-pointer select-none group border-slate-200 hover:border-amber-400">
                          <div class="flex items-center h-5 mr-3 mt-0.5">
                            <input type="checkbox" name="cleanup_option" value="category_alerts" class="dev-cleanup-checkbox w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer">
                          </div>
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between gap-2">
                              <span class="text-xs font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                                Alertas de Categorías Antiguas (>30 días)
                              </span>
                              <span class="px-2 py-0.5 rounded-full text-[11px] font-black ${cleanupStats.oldCategoryAlerts > 0 ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-400'}">
                                ${cleanupStats.oldCategoryAlerts || 0}
                              </span>
                            </div>
                            <p class="text-[11px] text-slate-500 mt-1 leading-snug">
                              Solicitudes de nuevas categorías que ya fueron aprobadas/archivadas o tienen más de 30 días de registradas.
                            </p>
                          </div>
                        </label>

                        <!-- Opción 4: Citas Canceladas Antiguas -->
                        <label class="relative flex items-start p-4 bg-white rounded-2xl border-2 transition-all cursor-pointer select-none group border-slate-200 hover:border-amber-400">
                          <div class="flex items-center h-5 mr-3 mt-0.5">
                            <input type="checkbox" name="cleanup_option" value="cancelled_appointments" class="dev-cleanup-checkbox w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer">
                          </div>
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between gap-2">
                              <span class="text-xs font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                                Citas Canceladas Antiguas (>60 días)
                              </span>
                              <span class="px-2 py-0.5 rounded-full text-[11px] font-black ${cleanupStats.oldCancelledAppointments > 0 ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-400'}">
                                ${cleanupStats.oldCancelledAppointments || 0}
                              </span>
                            </div>
                            <p class="text-[11px] text-slate-500 mt-1 leading-snug">
                              Historial de citas en estado 'cancelled' con más de 2 meses de antigüedad. No afecta citas activas ni completadas.
                            </p>
                          </div>
                        </label>

                        <!-- Opción 5: Pre-registros Gestionados Antiguos -->
                        <label class="relative flex items-start p-4 bg-white rounded-2xl border-2 transition-all cursor-pointer select-none group border-slate-200 hover:border-amber-400 md:col-span-2">
                          <div class="flex items-center h-5 mr-3 mt-0.5">
                            <input type="checkbox" name="cleanup_option" value="handled_preregistrations" class="dev-cleanup-checkbox w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer">
                          </div>
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between gap-2">
                              <span class="text-xs font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                                Pre-registros Contactados / Gestionados (>60 días)
                              </span>
                              <span class="px-2 py-0.5 rounded-full text-[11px] font-black ${cleanupStats.handledPreRegistrations > 0 ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-400'}">
                                ${cleanupStats.handledPreRegistrations || 0}
                              </span>
                            </div>
                            <p class="text-[11px] text-slate-500 mt-1 leading-snug">
                              Contactos de la etapa de prelanzamiento que ya fueron gestionados y tienen más de 60 días de antigüedad.
                            </p>
                          </div>
                        </label>

                      </div>

                      <div class="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200">
                        <div class="text-xs text-slate-600 font-medium">
                          <span id="dev-cleanup-selected-count" class="font-bold text-slate-900">0</span> opciones seleccionadas para depurar.
                        </div>

                        <button type="button" id="dev-btn-execute-cleanup" class="w-full sm:w-auto px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer">
                          <i class="fas fa-trash-alt"></i>
                          <span>Ejecutar Depuración Seleccionada</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  <!-- SECCIÓN 2: EXPORTACIÓN DE CLIENTES ATENDIDOS A EXCEL -->
                  <div class="bg-gradient-to-br from-indigo-950/90 via-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-900/50 space-y-6">
                    
                    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                      <div>
                        <div class="flex items-center gap-2.5">
                          <span class="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-base">
                            <i class="fas fa-file-excel"></i>
                          </span>
                          <div>
                            <h3 class="text-lg font-black text-white">Descarga de Clientes Atendidos & Citas (Excel .xlsx)</h3>
                            <span class="text-[11px] text-emerald-400 font-mono font-bold">Reporte Profesional con formato monetario ₡ y enlace WhatsApp</span>
                          </div>
                        </div>
                        <p class="text-xs text-slate-300 mt-2">
                          Genera y descarga una hoja de cálculo en Excel estructurada profesionalmente con los datos de clientes, servicios, precios y teléfonos para el comercio seleccionado o para toda la plataforma.
                        </p>
                      </div>

                      <div class="px-3.5 py-2 bg-slate-800/80 rounded-2xl border border-slate-700/80 text-right self-start">
                        <span class="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Total Citas en BD</span>
                        <span class="text-base font-black text-amber-400">${appointments.length}</span>
                      </div>
                    </div>

                    <form id="dev-export-excel-form" class="space-y-4">
                      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        
                        <!-- Filtro: Comercio -->
                        <div class="space-y-1.5 sm:col-span-2 lg:col-span-1">
                          <label class="block text-xs font-bold text-slate-200">
                            <i class="fas fa-store text-indigo-400 mr-1"></i> Seleccionar Comercio:
                          </label>
                          <select id="dev-export-biz-select" class="w-full px-3 py-2.5 bg-slate-800/90 border border-slate-700 text-white rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                            <option value="all">🏢 Todos los Comercios (${businesses.length})</option>
                            ${businesses.map(b => `
                              <option value="${b.id}">${this.escapeHtml(b.name)} (${b.categoryLabel || 'General'})</option>
                            `).join('')}
                          </select>
                        </div>

                        <!-- Filtro: Estado de Citas -->
                        <div class="space-y-1.5 sm:col-span-2 lg:col-span-1">
                          <label class="block text-xs font-bold text-slate-200">
                            <i class="fas fa-check-circle text-emerald-400 mr-1"></i> Estado de Cita:
                          </label>
                          <select id="dev-export-status-select" class="w-full px-3 py-2.5 bg-slate-800/90 border border-slate-700 text-white rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                            <option value="completed" selected>✅ Solo Completadas / Atendidas (Recomendado)</option>
                            <option value="confirmed">📅 Confirmadas</option>
                            <option value="all">📋 Todas (Atendidas, Confirmadas, Pendientes, Canceladas)</option>
                          </select>
                        </div>

                        <!-- Filtro: Fecha Desde -->
                        <div class="space-y-1.5">
                          <label class="block text-xs font-bold text-slate-200">
                            <i class="fas fa-calendar-day text-blue-400 mr-1"></i> Fecha Desde:
                          </label>
                          <input type="date" id="dev-export-start-date" class="w-full px-3 py-2.5 bg-slate-800/90 border border-slate-700 text-white rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                        </div>

                        <!-- Filtro: Fecha Hasta -->
                        <div class="space-y-1.5">
                          <label class="block text-xs font-bold text-slate-200">
                            <i class="fas fa-calendar-day text-blue-400 mr-1"></i> Fecha Hasta:
                          </label>
                          <input type="date" id="dev-export-end-date" class="w-full px-3 py-2.5 bg-slate-800/90 border border-slate-700 text-white rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                        </div>

                      </div>

                      <!-- Presets rápidos de fechas y Botón Descargar -->
                      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-800">
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="text-[11px] text-slate-400 font-bold mr-1">Rango rápido:</span>
                          <button type="button" id="dev-preset-this-month" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-200 rounded-lg font-bold transition-colors cursor-pointer">
                            Este Mes
                          </button>
                          <button type="button" id="dev-preset-last-month" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-200 rounded-lg font-bold transition-colors cursor-pointer">
                            Mes Anterior
                          </button>
                          <button type="button" id="dev-preset-all-time" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-200 rounded-lg font-bold transition-colors cursor-pointer">
                            Todo el Historial
                          </button>
                        </div>

                        <button type="submit" id="dev-btn-download-excel" class="px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black rounded-xl text-xs sm:text-sm shadow-lg shadow-emerald-950/30 transition-all flex items-center justify-center gap-2.5 cursor-pointer">
                          <i class="fas fa-file-excel text-base"></i>
                          <span>Descargar Excel Estructurado (.xlsx)</span>
                        </button>
                      </div>
                    </form>
                  </div>

                </div>
              ` : ''}

            </div>
          </div>
        </div>
      `;

      // Event Listeners del Panel Developer
      document.getElementById('dev-logout-view-btn')?.addEventListener('click', () => {
        storage.logoutDeveloper();
        this.showToast('Sesión de Developer cerrada.', 'info');
        this.renderHeader();
        this.navigateTo('directory');
      });

      // Tabs Switch
      document.getElementById('dev-tab-alerts')?.addEventListener('click', () => {
        this.activeDevTab = 'alerts';
        this.renderDeveloperDashboardView(container);
      });
      document.getElementById('dev-tab-businesses')?.addEventListener('click', () => {
        this.activeDevTab = 'businesses';
        this.renderDeveloperDashboardView(container);
      });
      document.getElementById('dev-tab-clients')?.addEventListener('click', () => {
        this.activeDevTab = 'clients';
        this.renderDeveloperDashboardView(container);
      });
      document.getElementById('dev-tab-appointments')?.addEventListener('click', () => {
        this.activeDevTab = 'appointments';
        this.renderDeveloperDashboardView(container);
      });
      document.getElementById('dev-tab-whatsapp')?.addEventListener('click', () => {
        this.activeDevTab = 'whatsapp';
        this.renderDeveloperDashboardView(container);
      });
      document.getElementById('dev-tab-preregistrations')?.addEventListener('click', () => {
        this.activeDevTab = 'preregistrations';
        this.renderDeveloperDashboardView(container);
      });
      document.getElementById('dev-tab-sinpe')?.addEventListener('click', () => {
        this.activeDevTab = 'sinpe';
        this.renderDeveloperDashboardView(container);
      });
      document.getElementById('dev-tab-paypal')?.addEventListener('click', () => {
        this.activeDevTab = 'paypal';
        this.renderDeveloperDashboardView(container);
      });
      document.getElementById('dev-tab-maintenance')?.addEventListener('click', () => {
        this.activeDevTab = 'maintenance';
        this.renderDeveloperDashboardView(container);
      });

      // MANTENIMIENTO: Checkboxes y Acciones de Depuración
      const updateCleanupCount = () => {
        const checked = document.querySelectorAll('.dev-cleanup-checkbox:checked');
        const countEl = document.getElementById('dev-cleanup-selected-count');
        if (countEl) countEl.textContent = checked.length;
      };

      document.querySelectorAll('.dev-cleanup-checkbox').forEach(cb => {
        cb.addEventListener('change', updateCleanupCount);
      });

      document.getElementById('dev-select-all-cleanup-btn')?.addEventListener('click', () => {
        document.querySelectorAll('.dev-cleanup-checkbox').forEach(cb => { cb.checked = true; });
        updateCleanupCount();
      });

      document.getElementById('dev-clear-all-cleanup-btn')?.addEventListener('click', () => {
        document.querySelectorAll('.dev-cleanup-checkbox').forEach(cb => { cb.checked = false; });
        updateCleanupCount();
      });

      // Ejecutar Depuración Seleccionada
      document.getElementById('dev-btn-execute-cleanup')?.addEventListener('click', () => {
        const checked = Array.from(document.querySelectorAll('.dev-cleanup-checkbox:checked')).map(cb => cb.value);
        if (checked.length === 0) {
          this.showToast('Selecciona al menos una casilla de datos para depurar.', 'warning');
          return;
        }

        const options = {
          otp: checked.includes('otp'),
          dateBlocks: checked.includes('date_blocks'),
          categoryAlerts: checked.includes('category_alerts'),
          cancelledAppointments: checked.includes('cancelled_appointments'),
          handledPreRegistrations: checked.includes('handled_preregistrations')
        };

        this.renderCleanupConfirmModal(options, async () => {
          try {
            const btn = document.getElementById('dev-btn-execute-cleanup');
            if (btn) {
              btn.disabled = true;
              btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Depurando...';
            }
            const res = await storage.executeDatabaseCleanup(options);
            this.showToast(`¡Depuración completada! Se eliminaron ${res.totalPurged || 0} registros.`, 'success');
            this.renderDeveloperDashboardView(container);
          } catch (err) {
            this.showToast(err.message || 'Error al ejecutar depuración.', 'error');
          }
        });
      });

      // EXPORTACIÓN A EXCEL: Presets de fechas
      const setDateRange = (start, end) => {
        const startInput = document.getElementById('dev-export-start-date');
        const endInput = document.getElementById('dev-export-end-date');
        if (startInput) startInput.value = start;
        if (endInput) endInput.value = end;
      };

      document.getElementById('dev-preset-this-month')?.addEventListener('click', () => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
        setDateRange(`${y}-${m}-01`, `${y}-${m}-${String(lastDay).padStart(2, '0')}`);
      });

      document.getElementById('dev-preset-last-month')?.addEventListener('click', () => {
        const now = new Date();
        const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const y = prevMonthDate.getFullYear();
        const m = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
        const lastDay = new Date(y, prevMonthDate.getMonth() + 1, 0).getDate();
        setDateRange(`${y}-${m}-01`, `${y}-${m}-${String(lastDay).padStart(2, '0')}`);
      });

      document.getElementById('dev-preset-all-time')?.addEventListener('click', () => {
        setDateRange('', '');
      });

      // Submit exportación Excel
      document.getElementById('dev-export-excel-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const bizSelect = document.getElementById('dev-export-biz-select');
        const statusSelect = document.getElementById('dev-export-status-select');
        const startInput = document.getElementById('dev-export-start-date');
        const endInput = document.getElementById('dev-export-end-date');

        const businessId = bizSelect ? bizSelect.value : 'all';
        const status = statusSelect ? statusSelect.value : 'completed';
        const startDate = startInput ? startInput.value : '';
        const endDate = endInput ? endInput.value : '';

        const downloadUrl = storage.getExportExcelUrl({ businessId, status, startDate, endDate });
        this.showToast('Generando reporte Excel...', 'info');
        window.open(downloadUrl, '_blank');
      });

      // Botón: Activar Comercio por SINPE Móvil
      document.querySelectorAll('.dev-activate-sinpe-biz-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const bizId = btn.getAttribute('data-biz-id');
          const select = document.getElementById(`dev-sinpe-plan-select-${bizId}`);
          const planId = select ? select.value : 'pro';
          const daysValid = planId === 'test' ? 1 : 30;

          try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Activando...';
            await storage.activateBusinessPlan(bizId, planId, daysValid);
            this.showToast(`¡Plan ${planId.toUpperCase()} activado exitosamente para el comercio!`, 'success');
            this.renderDeveloperDashboardView(container);
          } catch (err) {
            this.showToast(err.message || 'Error al activar plan', 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check-circle"></i> Activar Plan';
          }
        });
      });

      // Guardar Configuración de PayPal
      document.getElementById('dev-paypal-settings-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = document.getElementById('dev-save-paypal-btn');
        const msgBox = document.getElementById('dev-paypal-save-msg');
        const clientId = document.getElementById('dev-paypal-client-id')?.value;
        const clientSecret = document.getElementById('dev-paypal-client-secret')?.value;
        const env = document.getElementById('dev-paypal-env')?.value;
        const planBasic = document.getElementById('dev-paypal-plan-basic')?.value;
        const planPro = document.getElementById('dev-paypal-plan-pro')?.value;
        const planUnlimited = document.getElementById('dev-paypal-plan-unlimited')?.value;

        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Guardando...';
        }

        try {
          await storage.savePayPalSettings({ clientId, clientSecret, env, planBasic, planPro, planUnlimited });
          if (msgBox) {
            msgBox.className = 'p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold block';
            msgBox.textContent = '¡Ajustes de PayPal guardados con éxito!';
          }
          this.showToast('Ajustes de PayPal guardados.', 'success');
        } catch (err) {
          if (msgBox) {
            msgBox.className = 'p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold block';
            msgBox.textContent = err.message || 'Error guardando ajustes.';
          }
        } finally {
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save mr-1"></i> Guardar Ajustes de PayPal';
          }
        }
      });

      // Sincronizar Planes en PayPal
      document.getElementById('dev-sync-paypal-plans-btn')?.addEventListener('click', async () => {
        const syncBtn = document.getElementById('dev-sync-paypal-plans-btn');
        const consoleText = document.getElementById('dev-paypal-console-text');

        if (syncBtn) {
          syncBtn.disabled = true;
          syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Conectando con PayPal API...';
        }
        if (consoleText) {
          consoleText.innerHTML = '<span class="text-amber-400">⏳ Conectando con API de PayPal y generando planes ($8, $15, $25)...</span>';
        }

        try {
          const res = await storage.syncPayPalPlans();
          if (consoleText) {
            consoleText.innerHTML = `
              <span class="text-emerald-400">✅ ¡Planes creados y sincronizados exitosamente!</span><br>
              <span class="text-slate-300">📦 Producto ID: ${res.productId}</span><br>
              <span class="text-slate-300">🔹 Plan Básico: ${res.plans.paypal_plan_basic_id}</span><br>
              <span class="text-amber-300">⭐ Plan Pro: ${res.plans.paypal_plan_pro_id}</span><br>
              <span class="text-purple-300">👑 Plan Ilimitado: ${res.plans.paypal_plan_unlimited_id}</span>
            `;
          }
          this.showToast('¡Planes sincronizados con PayPal!', 'success');
          setTimeout(() => this.renderDeveloperDashboardView(container), 2000);
        } catch (err) {
          if (consoleText) {
            consoleText.innerHTML = `<span class="text-rose-400">❌ Error: ${err.message}</span>`;
          }
          this.showToast(err.message || 'Error al sincronizar planes.', 'error');
        } finally {
          if (syncBtn) {
            syncBtn.disabled = false;
            syncBtn.innerHTML = '<i class="fas fa-magic mr-1"></i> Sincronizar y Crear Planes en PayPal';
          }
        }
      });

      // Guardar Configuración de WhatsApp
      document.getElementById('dev-save-wa-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const tokenInput = document.getElementById('dev-wa-token');
        const phoneIdInput = document.getElementById('dev-wa-phone-id');
        const wabaIdInput = document.getElementById('dev-wa-waba-id');
        const saveBtn = document.getElementById('dev-save-wa-btn');

        const token = tokenInput?.value?.trim();
        const phoneNumberId = phoneIdInput?.value?.trim();
        const wabaId = wabaIdInput?.value?.trim();

        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Guardando...';
        }

        try {
          const payload = { phoneNumberId, wabaId };
          if (token) payload.token = token;

          await storage.saveWhatsAppSettings(payload);
          this.showToast('¡Credenciales de Meta WhatsApp guardadas con éxito!', 'success');
          this.renderDeveloperDashboardView(container);
        } catch (err) {
          this.showToast(err.message || 'Error guardando credenciales.', 'error');
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save mr-1"></i> Guardar Credenciales en Base de Datos';
          }
        }
      });

      // Toggle visibilidad del token
      document.getElementById('dev-wa-token-toggle')?.addEventListener('click', () => {
        const tokenInput = document.getElementById('dev-wa-token');
        if (tokenInput) {
          tokenInput.type = tokenInput.type === 'password' ? 'text' : 'password';
        }
      });

      // Enviar WhatsApp de prueba en vivo
      document.getElementById('dev-send-test-wa-btn')?.addEventListener('click', async () => {
        const phoneInput = document.getElementById('dev-test-phone-input');
        const resultText = document.getElementById('dev-wa-test-result-text');
        const testBtn = document.getElementById('dev-send-test-wa-btn');
        const phone = phoneInput?.value?.trim();

        if (!phone) {
          this.showToast('Ingresa un número de teléfono para la prueba.', 'error');
          return;
        }

        if (testBtn) {
          testBtn.disabled = true;
          testBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
        }
        if (resultText) {
          resultText.className = 'text-amber-400 animate-pulse';
          resultText.textContent = `Enviando mensaje de prueba a ${phone} mediante Meta Cloud API...`;
        }

        try {
          const res = await storage.testWhatsAppNotification(phone);
          if (res.result?.success) {
            if (resultText) {
              resultText.className = 'text-emerald-400 font-bold';
              resultText.textContent = `✅ ÉXITO: Mensaje enviado por ${res.result.provider || 'Meta'} (ID: ${res.result.messageId || res.result.sid || 'OK'})`;
            }
            this.showToast('¡WhatsApp de prueba entregado con éxito!', 'success');
          } else {
            const errDetail = res.result?.error || res.error || res.result?.reason || 'Error desconocido';
            if (resultText) {
              resultText.className = 'text-rose-400';
              resultText.textContent = `❌ FALLO DE META: ${errDetail}`;
            }
            this.showToast('Error al enviar WhatsApp. Revisa la consola abajo.', 'error');
          }
        } catch (e) {
          if (resultText) {
            resultText.className = 'text-rose-400';
            resultText.textContent = `❌ ERROR: ${e.message}`;
          }
          this.showToast('Error de conexión al enviar WhatsApp.', 'error');
        } finally {
          if (testBtn) {
            testBtn.disabled = false;
            testBtn.innerHTML = '<i class="fas fa-play text-[10px]"></i> <span>Enviar Test</span>';
          }
        }
      });

      // Subfiltros de negocios
      document.querySelectorAll('.dev-biz-filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          this.devBizFilter = e.currentTarget.getAttribute('data-filter') || 'all';
          this.renderDeveloperDashboardView(container);
        });
      });

      // Buscador
      const searchInput = document.getElementById('dev-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.devSearchQuery = e.target.value;
          this.renderDeveloperDashboardView(container);
        });
        if (this.devSearchQuery) {
          searchInput.focus();
          searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
        }
      }

      // Descartar/Revisar alerta
      document.querySelectorAll('.dismiss-alert-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const alertId = e.currentTarget.getAttribute('data-id');
          if (alertId) {
            await storage.dismissCategoryAlert(alertId);
            this.showToast('Alerta marcada como revisada.', 'success');
            this.renderDeveloperDashboardView(container);
          }
        });
      });

      // Ver negocio en directorio
      document.querySelectorAll('.dev-view-biz-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const bizId = e.currentTarget.getAttribute('data-id');
          if (bizId) {
            this.navigateTo('business-detail', { businessId: bizId });
          }
        });
      });

      // Modificar / Editar negocio
      document.querySelectorAll('.dev-edit-biz-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const bizId = e.currentTarget.getAttribute('data-id');
          if (bizId) {
            this.renderEditBusinessModal(bizId);
          }
        });
      });

      // Ocultar / Mostrar en la página principal
      document.querySelectorAll('.dev-toggle-visibility-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const bizId = e.currentTarget.getAttribute('data-id');
          const action = e.currentTarget.getAttribute('data-action');
          const bizName = e.currentTarget.getAttribute('data-name');
          const shouldHide = action === 'hide';

          try {
            await storage.toggleBusinessVisibility(bizId, shouldHide);
            this.showToast(
              shouldHide 
                ? `El comercio "${bizName}" ha sido ocultado de la página principal.` 
                : `El comercio "${bizName}" ahora es visible en la página principal.`,
              'success'
            );
            this.renderDeveloperDashboardView(container);
          } catch (err) {
            this.showToast(err.message || 'Error al actualizar visibilidad.', 'error');
          }
        });
      });

      // Bloquear / Desbloquear comercio
      document.querySelectorAll('.dev-toggle-block-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const bizId = e.currentTarget.getAttribute('data-id');
          const action = e.currentTarget.getAttribute('data-action');
          const bizName = e.currentTarget.getAttribute('data-name');

          if (action === 'block') {
            const reason = prompt(`¿Motivo de suspensión/bloqueo para "${bizName}"? (opcional):`, 'Suspensión administrativa temporal');
            if (reason !== null) {
              try {
                await storage.toggleBusinessBlock(bizId, true, reason);
                this.showToast(`El comercio "${bizName}" ha sido BLOQUEADO/SUSPENDIDO.`, 'warning');
                this.renderDeveloperDashboardView(container);
              } catch (err) {
                this.showToast(err.message || 'Error al bloquear comercio.', 'error');
              }
            }
          } else {
            if (confirm(`¿Deseas desbloquear el comercio "${bizName}" para que vuelva a recibir reservas?`)) {
              try {
                await storage.toggleBusinessBlock(bizId, false, '');
                this.showToast(`El comercio "${bizName}" ha sido DESBLOQUEADO exitosamente.`, 'success');
                this.renderDeveloperDashboardView(container);
              } catch (err) {
                this.showToast(err.message || 'Error al desbloquear comercio.', 'error');
              }
            }
          }
        });
      });

      // Eliminar negocio
      document.querySelectorAll('.dev-delete-biz-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const bizId = e.currentTarget.getAttribute('data-id');
          const bizName = e.currentTarget.getAttribute('data-name');
          if (confirm(`⚠️ ATENCIÓN: ¿Estás seguro de que deseas ELIMINAR PERMANENTEMENTE el negocio "${bizName}"?\n\nEsta acción borrará todos sus servicios, reservas asociadas y usuarios en la base de datos.`)) {
            try {
              await storage.deleteBusinessByDeveloper(bizId);
              this.showToast(`Negocio "${bizName}" eliminado definitivamente.`, 'success');
              this.renderDeveloperDashboardView(container);
            } catch (err) {
              this.showToast(err.message || 'Error al eliminar.', 'error');
            }
          }
        });
      });

      // Cambiar Plan de Suscripción desde el Panel Developer
      document.querySelectorAll('.dev-change-plan-select').forEach(sel => {
        sel.addEventListener('change', async (e) => {
          const bizId = e.target.getAttribute('data-id');
          const bizName = e.target.getAttribute('data-name');
          const newPlan = e.target.value;
          const planNames = {
            basic: 'Plan Básico ($10 • 150 reservas)',
            pro: 'Plan Profesional ($18 • 300 reservas)',
            unlimited: 'Plan Ilimitado ($35 • Reservas Ilimitadas)'
          };

          try {
            e.target.disabled = true;
            await storage.setDeveloperBusinessPlan(bizId, newPlan);
            this.showToast(`¡Plan de "${bizName}" actualizado a ${planNames[newPlan] || newPlan}!`, 'success');
            this.renderDeveloperDashboardView(container);
          } catch (err) {
            this.showToast(err.message || 'Error al actualizar el plan del negocio.', 'error');
            e.target.disabled = false;
          }
        });
      });

      // --- ACCIONES DE PRE-REGISTROS ---
      // 1. Modificar Pre-registro
      document.querySelectorAll('.dev-edit-prereg-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const prId = e.currentTarget.getAttribute('data-id');
          if (prId) {
            this.renderEditPreRegistrationModal(prId);
          }
        });
      });

      // 2. Bloquear / Descartar / Reactivar Pre-registro
      document.querySelectorAll('.dev-toggle-block-prereg-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const prId = e.currentTarget.getAttribute('data-id');
          const action = e.currentTarget.getAttribute('data-action');
          const name = e.currentTarget.getAttribute('data-name');

          if (action === 'block') {
            const reason = prompt(`¿Motivo para descartar/bloquear el pre-registro de "${name}"? (opcional):`, 'Número no responde / Datos inválidos');
            if (reason !== null) {
              try {
                await storage.togglePreRegistrationBlock(prId, true, reason);
                this.showToast(`Pre-registro de "${name}" descartado/bloqueado.`, 'warning');
                this.renderDeveloperDashboardView(container);
              } catch (err) {
                this.showToast(err.message || 'Error al bloquear.', 'error');
              }
            }
          } else {
            if (confirm(`¿Deseas reactivar el pre-registro de "${name}"?`)) {
              try {
                await storage.togglePreRegistrationBlock(prId, false, '');
                this.showToast(`Pre-registro de "${name}" reactivado.`, 'success');
                this.renderDeveloperDashboardView(container);
              } catch (err) {
                this.showToast(err.message || 'Error al reactivar.', 'error');
              }
            }
          }
        });
      });

      // 3. Eliminar Pre-registro
      document.querySelectorAll('.dev-delete-prereg-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const prId = e.currentTarget.getAttribute('data-id');
          const name = e.currentTarget.getAttribute('data-name');
          if (confirm(`⚠️ ¿Estás seguro de que deseas ELIMINAR el pre-registro de "${name}"?\n\nEsta acción no se puede deshacer.`)) {
            try {
              await storage.deletePreRegistrationByDeveloper(prId);
              this.showToast(`Pre-registro de "${name}" eliminado.`, 'success');
              this.renderDeveloperDashboardView(container);
            } catch (err) {
              this.showToast(err.message || 'Error al eliminar pre-registro.', 'error');
            }
          }
        });
      });

      // --- ACCIONES DE CLIENTES / USUARIOS ---
      // 1. Modificar Cliente
      document.querySelectorAll('.dev-edit-client-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const clientId = e.currentTarget.getAttribute('data-id');
          if (clientId) {
            this.renderEditClientModal(clientId);
          }
        });
      });

      // 2. Bloquear / Desbloquear Cliente
      document.querySelectorAll('.dev-toggle-block-client-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const clientId = e.currentTarget.getAttribute('data-id');
          const action = e.currentTarget.getAttribute('data-action');
          const name = e.currentTarget.getAttribute('data-name');

          if (action === 'block') {
            const reason = prompt(`¿Motivo de suspensión/bloqueo para el usuario "${name}"? (opcional):`, 'Suspensión por incumplimiento');
            if (reason !== null) {
              try {
                await storage.toggleClientBlock(clientId, true, reason);
                this.showToast(`Usuario "${name}" bloqueado/suspendido.`, 'warning');
                this.renderDeveloperDashboardView(container);
              } catch (err) {
                this.showToast(err.message || 'Error al bloquear usuario.', 'error');
              }
            }
          } else {
            if (confirm(`¿Deseas desbloquear al usuario "${name}"?`)) {
              try {
                await storage.toggleClientBlock(clientId, false, '');
                this.showToast(`Usuario "${name}" desbloqueado exitosamente.`, 'success');
                this.renderDeveloperDashboardView(container);
              } catch (err) {
                this.showToast(err.message || 'Error al desbloquear usuario.', 'error');
              }
            }
          }
        });
      });

      // 3. Eliminar Cliente
      document.querySelectorAll('.dev-delete-client-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const clientId = e.currentTarget.getAttribute('data-id');
          const name = e.currentTarget.getAttribute('data-name');
          if (confirm(`⚠️ ¿Estás seguro de que deseas ELIMINAR al usuario "${name}"?\n\nEsta acción borrará su cuenta del sistema.`)) {
            try {
              await storage.deleteClientByDeveloper(clientId);
              this.showToast(`Usuario "${name}" eliminado permanentemente.`, 'success');
              this.renderDeveloperDashboardView(container);
            } catch (err) {
              this.showToast(err.message || 'Error al eliminar cliente.', 'error');
            }
          }
        });
      });

    } catch (err) {
      console.error(err);
      container.innerHTML = `
        <div class="max-w-md mx-auto my-16 p-8 bg-white rounded-3xl border border-rose-200 text-center shadow-lg">
          <i class="fas fa-exclamation-triangle text-3xl text-rose-500 mb-3"></i>
          <h2 class="text-lg font-bold text-slate-800 mb-1">Error al cargar datos</h2>
          <p class="text-xs text-slate-500 mb-4">${err.message || 'No se pudo conectar con el servidor.'}</p>
          <button id="dev-retry-btn" class="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl shadow-md">Reintentar</button>
        </div>
      `;
      document.getElementById('dev-retry-btn')?.addEventListener('click', () => this.renderDeveloperDashboardView(container));
    }
  }

  // ==========================================
  // MODAL DE CONFIRMACIÓN DE DEPURACIÓN (DEVELOPER)
  // ==========================================
  renderCleanupConfirmModal(options, callback) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const items = [];
    if (options.otp) items.push('🔑 Códigos OTP de recuperación de contraseña expirados (>15 min) o usados');
    if (options.dateBlocks) items.push('📅 Bloqueos de fechas y feriados pasados');
    if (options.categoryAlerts) items.push('🏷️ Alertas de solicitudes de categorías antiguas (>30 días)');
    if (options.cancelledAppointments) items.push('❌ Historial de citas canceladas antiguas (>60 días)');
    if (options.handledPreRegistrations) items.push('🚀 Pre-registros de comercios contactados/gestionados (>60 días)');

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop animate-fade-in">
        <div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
          
          <div class="p-6 bg-gradient-to-r from-rose-950 via-slate-900 to-slate-900 text-white flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span class="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center text-lg">
                <i class="fas fa-exclamation-triangle"></i>
              </span>
              <div>
                <h3 class="text-base font-black">Confirmar Depuración</h3>
                <span class="text-xs text-rose-300">Acción permanente de base de datos</span>
              </div>
            </div>
            <button id="dev-cleanup-modal-close-btn" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center transition-colors cursor-pointer">
              <i class="fas fa-times text-sm"></i>
            </button>
          </div>

          <div class="p-6 space-y-4">
            <p class="text-xs text-slate-600 font-medium leading-relaxed">
              Estás a punto de depurar de forma permanente los siguientes registros seleccionados de la base de datos:
            </p>

            <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs font-semibold text-slate-800">
              ${items.map(it => `
                <div class="flex items-start gap-2">
                  <i class="fas fa-check-circle text-rose-500 mt-0.5 flex-shrink-0 text-xs"></i>
                  <span>${it}</span>
                </div>
              `).join('')}
            </div>

            <div class="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-900 text-[11px] flex items-start gap-2">
              <i class="fas fa-shield-alt text-rose-600 text-sm mt-0.5 flex-shrink-0"></i>
              <p>
                <strong>Nota:</strong> Los datos de comercios activos, servicios, clientes, reseñas y citas confirmadas <strong>NO</strong> se tocarán.
              </p>
            </div>

            <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button type="button" id="dev-cleanup-modal-cancel-btn" class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer">
                Cancelar
              </button>
              <button type="button" id="dev-cleanup-modal-confirm-btn" class="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer">
                <i class="fas fa-trash-alt"></i>
                <span>Confirmar y Depurar</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    `;

    const closeModal = () => {
      modalContainer.innerHTML = '';
    };

    document.getElementById('dev-cleanup-modal-close-btn')?.addEventListener('click', closeModal);
    document.getElementById('dev-cleanup-modal-cancel-btn')?.addEventListener('click', closeModal);
    document.getElementById('dev-cleanup-modal-confirm-btn')?.addEventListener('click', () => {
      closeModal();
      if (typeof callback === 'function') callback();
    });
  }

  // ==========================================
  // MODAL INTEGRADO DE AUTENTICACIÓN (LOGIN & REGISTRO)
  // ==========================================
  renderAuthModal({ mode = 'login', role = 'client', selectedPlanId = 'pro' } = {}) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    // Si el registro está deshabilitado temporalmente, forzar modo login
    if (!REGISTRATION_ENABLED) {
      mode = 'login';
    }

    const currentClient = storage.getClientUser();
    const categories = storage.getCategories().filter(c => c.id !== 'all');
    const plans = storage.getSubscriptionPlans();

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 modal-backdrop animate-fade-in overflow-y-auto">
        <div class="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl ${role === 'business' && mode === 'register' ? 'max-w-xl' : 'max-w-md'} w-full overflow-hidden border border-slate-200 my-0 sm:my-8 max-h-[92vh] flex flex-col mobile-bottom-sheet">
          
          <!-- Header del Modal -->
          <div class="bg-slate-900 p-5 text-white flex items-center justify-between shrink-0">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl ${role === 'business' ? 'bg-indigo-600' : 'bg-blue-600'} flex items-center justify-center text-white text-lg shadow-sm">
                <i class="fas ${role === 'business' ? 'fa-store' : 'fa-user-check'}"></i>
              </div>
              <div>
                <span class="text-[11px] uppercase tracking-wider ${role === 'business' ? 'text-indigo-300' : 'text-blue-300'} font-bold">
                  ${mode === 'login' ? 'Acceso Seguro' : 'Registro de Cuenta'}
                </span>
                <h3 class="text-base sm:text-lg font-bold">
                  ${mode === 'login' ? (role === 'business' ? 'Iniciar Sesión Negocio' : 'Iniciar Sesión Usuario') : (role === 'business' ? 'Registrar mi Negocio' : 'Crear Cuenta de Usuario')}
                </h3>
              </div>
            </div>
            <button id="close-auth-modal-btn" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer">
              <i class="fas fa-times text-sm"></i>
            </button>
          </div>

          <!-- Pestañas de Modo (Iniciar Sesión / Registrarse) y Selección de Rol (Cliente / Negocio) -->
          <div class="p-5 pb-0 shrink-0 space-y-3 bg-slate-50 border-b border-slate-200/80">
            <!-- Tabs Modo: Iniciar Sesión / Registrarse -->
            ${REGISTRATION_ENABLED ? `
            <div class="flex p-1 bg-slate-200/80 rounded-2xl">
              <button id="tab-mode-login" class="flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${mode === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}">
                <i class="fas fa-sign-in-alt text-xs ${mode === 'login' ? 'text-blue-600' : ''}"></i> Iniciar Sesión
              </button>
              <button id="tab-mode-register" class="flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${mode === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}">
                <i class="fas fa-user-plus text-xs ${mode === 'register' ? 'text-blue-600' : ''}"></i> Registrarse
              </button>
            </div>
            ` : `
            <!-- Registro temporalmente oculto: Solo Iniciar Sesión -->
            <div class="py-2 px-3 bg-blue-50/80 rounded-xl border border-blue-100 text-center text-xs font-extrabold text-blue-800 flex items-center justify-center gap-2">
              <i class="fas fa-lock text-blue-600"></i> Acceso a Cuentas Existentes
            </div>
            `}

            <!-- Tabs Rol: Cliente / Negocio -->
            <div class="flex gap-2 pb-3">
              <button id="tab-role-client" class="flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${role === 'client' ? 'bg-blue-600 border-blue-600 text-white shadow-xs' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'}">
                <i class="fas fa-user text-xs"></i> Soy Cliente
              </button>
              <button id="tab-role-business" class="flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${role === 'business' ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'}">
                <i class="fas fa-store text-xs"></i> Soy Negocio / Dueño
              </button>
            </div>
          </div>

          <!-- Cuerpo con Formularios Dinámicos -->
          <div class="p-6 space-y-4 overflow-y-auto flex-1">
            ${mode === 'login' && role === 'client' ? `
              <!-- FORM 1: LOGIN CLIENTE (TELÉFONO/CORREO Y CONTRASEÑA) -->
              <p class="text-xs text-slate-500">Ingresa con tu teléfono o correo y tu contraseña para gestionar tus reservas.</p>
              
              <div id="cli-log-inline-error" class="hidden p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2"></div>

              <form id="auth-client-login-form" class="space-y-4 text-xs sm:text-sm">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Teléfono o Correo Electrónico *</label>
                  <input type="text" id="cli-log-identifier" required placeholder="Ej. +506 8888 7777 o juan@correo.com" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none">
                </div>

                <div>
                  <div class="flex items-center justify-between mb-1">
                    <label class="block font-bold text-slate-700">Contraseña *</label>
                    <button type="button" class="btn-forgot-password text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer" data-role="client">
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <input type="password" id="cli-log-password" required placeholder="••••••••" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none">
                </div>

                <button type="submit" class="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer">
                  <i class="fas fa-sign-in-alt"></i>
                  <span>Iniciar Sesión como Cliente</span>
                </button>
              </form>
            ` : ''}

            ${mode === 'login' && role === 'business' ? `
              <!-- FORM 2: LOGIN NEGOCIO (CORREO Y CONTRASEÑA) -->
              <p class="text-xs text-slate-500">Ingresa tus credenciales para administrar tus reservas, servicios, precios, fotos y horarios.</p>
              
              <div id="biz-log-inline-error" class="hidden p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2"></div>

              <form id="auth-biz-login-form" class="space-y-4 text-xs sm:text-sm">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Correo Electrónico del Negocio *</label>
                  <input type="email" id="biz-log-email" required placeholder="correo@tucomercio.cr" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                </div>

                <div>
                  <div class="flex items-center justify-between mb-1">
                    <label class="block font-bold text-slate-700">Contraseña *</label>
                    <button type="button" class="btn-forgot-password text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer" data-role="business">
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <input type="password" id="biz-log-password" required placeholder="••••••••" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                </div>

                <button type="submit" class="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer">
                  <i class="fas fa-sign-in-alt"></i>
                  <span>Ingresar al Panel de Negocio</span>
                </button>
              </form>

              <!-- Acceso Rápido Demo -->
              <div class="pt-4 border-t border-slate-100">
                <span class="text-[11px] font-bold text-slate-400 uppercase block mb-2">⚡ Acceso Rápido a Comercios de Muestra (1-Clic)</span>
                <div class="grid grid-cols-2 gap-2">
                  <button type="button" class="quick-demo-btn p-2 text-left rounded-xl border border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 text-xs text-slate-700 transition-colors cursor-pointer" data-email="barberia@demo.cr" data-pass="123">
                    <span class="font-bold block truncate">Barbería Vintage</span>
                    <span class="text-[10px] text-slate-400">barberia@demo.cr</span>
                  </button>
                  <button type="button" class="quick-demo-btn p-2 text-left rounded-xl border border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 text-xs text-slate-700 transition-colors cursor-pointer" data-email="dental@demo.cr" data-pass="123">
                    <span class="font-bold block truncate">Clínica Dental</span>
                    <span class="text-[10px] text-slate-400">dental@demo.cr</span>
                  </button>
                  <button type="button" class="quick-demo-btn p-2 text-left rounded-xl border border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 text-xs text-slate-700 transition-colors cursor-pointer" data-email="spa@demo.cr" data-pass="123">
                    <span class="font-bold block truncate">Serenity Spa</span>
                    <span class="text-[10px] text-slate-400">spa@demo.cr</span>
                  </button>
                  <button type="button" class="quick-demo-btn p-2 text-left rounded-xl border border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 text-xs text-slate-700 transition-colors cursor-pointer" data-email="taller@demo.cr" data-pass="123">
                    <span class="font-bold block truncate">AutoCheck Taller</span>
                    <span class="text-[10px] text-slate-400">taller@demo.cr</span>
                  </button>
                </div>
              </div>
            ` : ''}

            ${mode === 'register' && role === 'client' ? `
              <!-- FORM 3: REGISTRO CLIENTE (CON CONTRASEÑA Y CONFIRMACIÓN) -->
              <p class="text-xs text-slate-500">Crea tu cuenta de cliente con contraseña segura para gestionar tus reservas en Costa Rica.</p>
              
              <form id="auth-client-reg-form" class="space-y-4 text-xs sm:text-sm">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Nombre Completo *</label>
                  <input type="text" id="cli-reg-name" required placeholder="Ej. Juan Pérez" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none">
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block font-bold text-slate-700 mb-1">Teléfono / WhatsApp (+506) *</label>
                    <input type="tel" id="cli-reg-phone" required placeholder="Ej. +506 8888 7777" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  </div>
                  <div>
                    <label class="block font-bold text-slate-700 mb-1">Correo Electrónico (Opcional)</label>
                    <input type="email" id="cli-reg-email" placeholder="juan@correo.com" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block font-bold text-slate-700 mb-1">Crear Contraseña *</label>
                    <input type="password" id="cli-reg-password" required minlength="6" placeholder="Mínimo 6 caracteres" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all">
                  </div>
                  <div>
                    <label class="block font-bold text-slate-700 mb-1">Confirmar Contraseña *</label>
                    <input type="password" id="cli-reg-password-confirm" required minlength="6" placeholder="Repite tu contraseña" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all">
                  </div>
                </div>

                <!-- Mensaje Inline de Validación de Contraseñas -->
                <div id="cli-reg-inline-error" class="hidden p-3 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all"></div>

                <!-- Consentimiento previo (Opt-in) WhatsApp -->
                <div class="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-2xl">
                  <label class="flex items-start gap-3 cursor-pointer select-none">
                    <input type="checkbox" id="cli-reg-whatsapp-optin" checked class="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-emerald-300">
                    <div class="text-xs text-slate-700 leading-relaxed">
                      <div class="font-bold text-emerald-800 flex items-center gap-1.5 mb-0.5">
                        <i class="fab fa-whatsapp text-emerald-600 text-sm"></i>
                        <span>Notificaciones de Reservas por WhatsApp (Opt-in)</span>
                      </div>
                      <p class="text-slate-600 text-[11px]">
                        Acepto recibir mensajes de confirmación de mis reservas y recordatorios de turnos vía WhatsApp a mi número telefónico.
                      </p>
                    </div>
                  </label>
                </div>

                <button type="submit" class="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer">
                  <i class="fas fa-user-plus"></i>
                  <span>Crear Cuenta de Cliente</span>
                </button>
              </form>
            ` : ''}

            ${mode === 'register' && role === 'business' ? `
              <!-- FORM 4: REGISTRO NUEVO NEGOCIO -->
              <form id="auth-biz-reg-form" class="space-y-4 text-xs sm:text-sm">
                
                <!-- 1. SELECCIÓN DE PLAN DE SUSCRIPCIÓN -->
                <div class="p-4 bg-slate-900 text-white rounded-2xl space-y-3 border border-indigo-500/30 shadow-md">
                  <div class="flex items-center justify-between">
                    <span class="font-black text-amber-400 block text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <i class="fas fa-tags"></i> Elige tu Plan de Suscripción *
                    </span>
                    <span class="text-[10px] text-slate-300 font-medium">Cambia o cancela cuando quieras</span>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <!-- Plan Básico -->
                    <label class="biz-plan-card-label relative p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${selectedPlanId === 'basic' ? 'bg-indigo-950 border-blue-400 ring-2 ring-blue-400/30' : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'}">
                      <input type="radio" name="new-biz-plan" value="basic" ${selectedPlanId === 'basic' ? 'checked' : ''} class="sr-only">
                      <div>
                        <div class="flex justify-between items-start mb-1">
                          <span class="font-black text-xs text-white">Básico</span>
                          <span class="text-[9px] font-bold text-blue-300 bg-blue-900/80 px-1.5 py-0.5 rounded">150 reservas</span>
                        </div>
                        <div class="text-base font-black text-white">$10 <span class="text-[10px] font-normal text-slate-400">/mes</span></div>
                        <p class="text-[10px] text-slate-400 mt-0.5">~₡5,200 CRC / mes</p>
                      </div>
                      <div class="text-[10px] text-slate-300 mt-2 pt-1 border-t border-slate-700/80 flex items-center gap-1">
                        <i class="fas fa-check text-emerald-400 text-[9px]"></i> 150 reservas/mes
                      </div>
                    </label>

                    <!-- Plan Profesional -->
                    <label class="biz-plan-card-label relative p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${selectedPlanId === 'pro' ? 'bg-indigo-950 border-amber-400 ring-2 ring-amber-400/30' : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'}">
                      <span class="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-amber-400 text-slate-950 text-[9px] font-black rounded-full shadow-xs uppercase tracking-wider z-10 pointer-events-none">Popular</span>
                      <input type="radio" name="new-biz-plan" value="pro" ${selectedPlanId === 'pro' ? 'checked' : ''} class="sr-only">
                      <div>
                        <div class="flex justify-between items-start mb-1">
                          <span class="font-black text-xs text-amber-300">Profesional</span>
                          <span class="text-[9px] font-bold text-amber-950 bg-amber-400 px-1.5 py-0.5 rounded">300 reservas</span>
                        </div>
                        <div class="text-base font-black text-amber-300">$18 <span class="text-[10px] font-normal text-slate-400">/mes</span></div>
                        <p class="text-[10px] text-slate-400 mt-0.5">~₡9,400 CRC / mes</p>
                      </div>
                      <div class="text-[10px] text-slate-300 mt-2 pt-1 border-t border-slate-700/80 flex items-center gap-1">
                        <i class="fas fa-check text-amber-400 text-[9px]"></i> 300 reservas/mes
                      </div>
                    </label>

                    <!-- Plan Ilimitado -->
                    <label class="biz-plan-card-label relative p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${selectedPlanId === 'unlimited' ? 'bg-indigo-950 border-purple-400 ring-2 ring-purple-400/30' : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'}">
                      <input type="radio" name="new-biz-plan" value="unlimited" ${selectedPlanId === 'unlimited' ? 'checked' : ''} class="sr-only">
                      <div>
                        <div class="flex justify-between items-start mb-1">
                          <span class="font-black text-xs text-purple-300">Ilimitado</span>
                          <span class="text-[9px] font-bold text-purple-300 bg-purple-900/80 px-1.5 py-0.5 rounded">Ilimitado</span>
                        </div>
                        <div class="text-base font-black text-purple-300">$35 <span class="text-[10px] font-normal text-slate-400">/mes</span></div>
                        <p class="text-[10px] text-slate-400 mt-0.5">~₡18,200 CRC / mes</p>
                      </div>
                      <div class="text-[10px] text-slate-300 mt-2 pt-1 border-t border-slate-700/80 flex items-center gap-1">
                        <i class="fas fa-infinity text-purple-400 text-[9px]"></i> Reservas sin límite
                      </div>
                    </label>
                  </div>
                </div>

                <!-- 1.1 MÉTODO DE PAGO INICIAL (SINPE MÓVIL O TARJETA/PAYPAL) -->
                <div class="p-4 bg-slate-900 text-white rounded-2xl space-y-3 border border-indigo-500/30 shadow-md">
                  <span class="font-black text-emerald-400 block text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <i class="fas fa-wallet"></i> Método de Pago *
                  </span>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <!-- Opción SINPE Móvil -->
                    <label class="biz-paymethod-label relative p-3 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 bg-indigo-950 border-emerald-400 ring-2 ring-emerald-400/30">
                      <input type="radio" name="new-biz-paymethod" value="sinpe" checked class="sr-only">
                      <div class="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center text-sm flex-shrink-0 mt-0.5">
                        <i class="fas fa-mobile-alt"></i>
                      </div>
                      <div class="flex-1">
                        <div class="flex items-center justify-between">
                          <span class="font-black text-xs text-white">SINPE Móvil</span>
                          <span class="text-[9px] font-black text-emerald-950 bg-emerald-400 px-1.5 py-0.5 rounded">Costa Rica 🇨🇷</span>
                        </div>
                        <p class="text-[10px] text-slate-300 mt-0.5">Transfiere al 7143-3852 y envía el comprobante por WhatsApp para activación rápida.</p>
                      </div>
                    </label>

                    <!-- Opción Tarjeta / PayPal -->
                    <label class="biz-paymethod-label relative p-3 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 bg-slate-800/80 border-slate-700 hover:border-slate-500">
                      <input type="radio" name="new-biz-paymethod" value="card_paypal" class="sr-only">
                      <div class="w-8 h-8 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center text-sm flex-shrink-0 mt-0.5">
                        <i class="fas fa-credit-card"></i>
                      </div>
                      <div class="flex-1">
                        <div class="flex items-center justify-between">
                          <span class="font-black text-xs text-white">Tarjeta / PayPal</span>
                          <span class="text-[9px] font-bold text-amber-300 bg-amber-950/80 px-1.5 py-0.5 rounded">Automático</span>
                        </div>
                        <p class="text-[10px] text-slate-300 mt-0.5">Suscripción recurrente con tarjeta de débito/crédito o cuenta PayPal.</p>
                      </div>
                    </label>
                  </div>
                </div>

                <!-- 2. Cuenta de Usuario / Credenciales -->
                <div class="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl space-y-3">
                  <span class="font-bold text-indigo-900 block text-xs uppercase tracking-wider">
                    <i class="fas fa-lock mr-1"></i> Credenciales de Acceso para el Dueño
                  </span>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label class="block font-bold text-slate-700 mb-1">Nombre del Administrador *</label>
                      <input type="text" id="reg-owner-name" required placeholder="Ej. Carlos Rodríguez" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium">
                    </div>
                    <div>
                      <label class="block font-bold text-slate-700 mb-1">Correo para Iniciar Sesión *</label>
                      <input type="email" id="reg-biz-email" required placeholder="admin@comercio.cr" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium">
                    </div>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label class="block font-bold text-slate-700 mb-1">Crea una Contraseña *</label>
                      <input type="password" id="reg-biz-password" required minlength="6" placeholder="Mínimo 6 caracteres" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all">
                    </div>
                    <div>
                      <label class="block font-bold text-slate-700 mb-1">Confirmar Contraseña *</label>
                      <input type="password" id="reg-biz-password-confirm" required minlength="6" placeholder="Repite tu contraseña" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all">
                    </div>
                  </div>

                  <!-- Mensaje Inline de Validación de Contraseñas -->
                  <div id="biz-reg-inline-error" class="hidden p-3 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all"></div>
                </div>

                <!-- 3. Datos Comerciales -->
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Nombre Comercial del Negocio *</label>
                  <input type="text" id="new-biz-name" required placeholder="Ej. Barbería Costa Rica, Clínica Dental..." class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none">
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block font-bold text-slate-700 mb-1">Categoría del Negocio *</label>
                    <select id="new-biz-cat" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none">
                      ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                      <option value="otra" class="font-bold text-blue-600">➕ Otra Categoría (Personalizada)</option>
                    </select>
                  </div>

                  <div>
                    <label class="block font-bold text-slate-700 mb-1">Provincia / Cantón *</label>
                    <input type="text" id="new-biz-city" required placeholder="Ej. San José, Escazú / Heredia..." class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  </div>
                </div>

                <!-- Caja para Categoría Personalizada (Aparece al seleccionar 'Otra Categoría') -->
                <div id="new-biz-custom-cat-box" class="hidden p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl animate-fade-in space-y-1">
                  <div class="flex items-center justify-between">
                    <label class="block text-xs font-bold text-blue-900">Escribe el Nombre de tu Nueva Categoría *</label>
                    <span class="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">Notificará al Developer</span>
                  </div>
                  <input type="text" id="new-biz-custom-cat" placeholder="Ej. Jardinería, Clases de Música, Lavado de Muebles..." class="w-full px-3.5 py-2 bg-white border border-blue-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none">
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block font-bold text-slate-700 mb-1">Teléfono / WhatsApp (+506) *</label>
                    <input type="tel" id="new-biz-phone" required placeholder="+506 8888 7777" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  </div>
                  <div>
                    <label class="block font-bold text-slate-700 mb-1">Dirección Exacta</label>
                    <input type="text" id="new-biz-address" placeholder="100m Oeste del Parque..." class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  </div>
                </div>

                <div>
                  <label class="block font-bold text-slate-700 mb-1">Descripción</label>
                  <textarea id="new-biz-desc" rows="2" placeholder="Describe brevemente tus especialidades..." class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"></textarea>
                </div>

                <!-- Fotos con Guía de Medidas -->
                <div class="p-4 bg-blue-50/70 border border-blue-100 rounded-2xl space-y-3">
                  <span class="font-bold text-blue-900 block text-xs uppercase tracking-wider">
                    <i class="fas fa-camera mr-1"></i> Fotos del Comercio (Guía de Medidas)
                  </span>

                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <label class="text-xs font-bold text-slate-700">Logo / Foto de Perfil</label>
                      <span class="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">Medida: 800 x 800 px (1:1)</span>
                    </div>
                    <input type="text" id="new-biz-image" placeholder="URL de imagen cuadrada" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs">
                  </div>

                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <label class="text-xs font-bold text-slate-700">Banner / Foto de Portada</label>
                      <span class="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">Medida: 1200 x 450 px (16:6)</span>
                    </div>
                    <input type="text" id="new-biz-cover" placeholder="URL del banner panorámico" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs">
                  </div>
                </div>

                <!-- Redes Sociales y Enlaces Web (Opcional) -->
                <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div class="flex items-center justify-between">
                    <span class="font-bold text-slate-800 block text-xs uppercase tracking-wider">
                      <i class="fas fa-share-alt mr-1 text-blue-600"></i> Redes Sociales y Web (Opcional)
                    </span>
                    <span class="text-[10px] text-slate-400 font-medium">Se mostrarán en tu perfil</span>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div class="relative">
                      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-pink-600 text-xs">
                        <i class="fab fa-instagram"></i>
                      </div>
                      <input type="text" id="new-biz-instagram" placeholder="Instagram (ej. @minegocio)" class="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-pink-400 focus:outline-none">
                    </div>

                    <div class="relative">
                      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-blue-600 text-xs">
                        <i class="fab fa-facebook"></i>
                      </div>
                      <input type="text" id="new-biz-facebook" placeholder="Facebook (ej. facebook.com/minegocio)" class="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-400 focus:outline-none">
                    </div>

                    <div class="relative">
                      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-900 text-xs">
                        <i class="fab fa-tiktok"></i>
                      </div>
                      <input type="text" id="new-biz-tiktok" placeholder="TikTok (ej. @minegocio)" class="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-slate-400 focus:outline-none">
                    </div>

                    <div class="relative">
                      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-600 text-xs">
                        <i class="fas fa-globe"></i>
                      </div>
                      <input type="text" id="new-biz-website" placeholder="Sitio Web / Menú Digital" class="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-400 focus:outline-none">
                    </div>
                  </div>
                </div>

                <!-- Primer Servicio -->
                <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <span class="font-bold text-slate-800 block text-xs uppercase tracking-wider">
                    <i class="fas fa-tag mr-1 text-emerald-600"></i> Primer Servicio
                  </span>

                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div class="sm:col-span-2">
                      <input type="text" id="first-srv-name" required placeholder="Nombre del servicio (Ej. Corte Clásico)" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs">
                    </div>
                    <div>
                      <input type="number" id="first-srv-price" required min="0" step="500" placeholder="Precio ₡ CRC" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold">
                    </div>
                  </div>
                </div>

                <button type="submit" class="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold shadow-lg shadow-emerald-500/25 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer">
                  <i class="fas fa-check-circle"></i>
                  <span>Crear Cuenta y Registrar Negocio</span>
                </button>
              </form>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    // Cerrar modal
    document.getElementById('close-auth-modal-btn')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
    });

    // Enlaces de Olvidé mi Contraseña
    document.querySelectorAll('.btn-forgot-password').forEach(btn => {
      btn.addEventListener('click', () => {
        const btnRole = btn.getAttribute('data-role') || role;
        const currentEmailInput = btnRole === 'business' ? document.getElementById('biz-log-email') : document.getElementById('cli-log-identifier');
        const prefilledEmail = currentEmailInput ? currentEmailInput.value.trim() : '';
        this.renderForgotPasswordModal({ role: btnRole, email: prefilledEmail });
      });
    });

    // Pestañas de Modo (Login / Register)
    document.getElementById('tab-mode-login')?.addEventListener('click', () => {
      this.renderAuthModal({ mode: 'login', role, selectedPlanId });
    });
    document.getElementById('tab-mode-register')?.addEventListener('click', () => {
      this.renderAuthModal({ mode: 'register', role, selectedPlanId });
    });

    // Pestañas de Rol (Cliente / Negocio)
    document.getElementById('tab-role-client')?.addEventListener('click', () => {
      this.renderAuthModal({ mode, role: 'client', selectedPlanId });
    });
    document.getElementById('tab-role-business')?.addEventListener('click', () => {
      this.renderAuthModal({ mode, role: 'business', selectedPlanId });
    });

    // Selector visual de planes
    document.querySelectorAll('.biz-plan-card-label').forEach(label => {
      label.addEventListener('click', () => {
        document.querySelectorAll('.biz-plan-card-label').forEach(l => {
          l.classList.remove('bg-indigo-950', 'border-blue-400', 'border-amber-400', 'border-purple-400', 'ring-2', 'ring-blue-400/30', 'ring-amber-400/30', 'ring-purple-400/30');
          l.classList.add('bg-slate-800/80', 'border-slate-700');
        });
        const radio = label.querySelector('input[type="radio"]');
        if (radio) {
          radio.checked = true;
          const val = radio.value;
          label.classList.remove('bg-slate-800/80', 'border-slate-700');
          label.classList.add('bg-indigo-950', 'ring-2');
          if (val === 'pro') label.classList.add('border-amber-400', 'ring-amber-400/30');
          else if (val === 'unlimited') label.classList.add('border-purple-400', 'ring-purple-400/30');
          else label.classList.add('border-blue-400', 'ring-blue-400/30');
        }
      });
    });

    // Selector visual de método de pago
    document.querySelectorAll('.biz-paymethod-label').forEach(label => {
      label.addEventListener('click', () => {
        document.querySelectorAll('.biz-paymethod-label').forEach(l => {
          l.classList.remove('bg-indigo-950', 'border-emerald-400', 'border-amber-400', 'ring-2', 'ring-emerald-400/30', 'ring-amber-400/30');
          l.classList.add('bg-slate-800/80', 'border-slate-700');
        });
        const radio = label.querySelector('input[type="radio"]');
        if (radio) {
          radio.checked = true;
          const val = radio.value;
          label.classList.remove('bg-slate-800/80', 'border-slate-700');
          label.classList.add('bg-indigo-950', 'ring-2');
          if (val === 'sinpe') label.classList.add('border-emerald-400', 'ring-emerald-400/30');
          else label.classList.add('border-amber-400', 'ring-amber-400/30');
        }
      });
    });

    // Toggle de Categoría Personalizada en Registro de Negocio
    const bizCatSelect = document.getElementById('new-biz-cat');
    const customCatBox = document.getElementById('new-biz-custom-cat-box');
    bizCatSelect?.addEventListener('change', () => {
      if (bizCatSelect.value === 'otra') {
        customCatBox?.classList.remove('hidden');
        document.getElementById('new-biz-custom-cat')?.focus();
      } else {
        customCatBox?.classList.add('hidden');
      }
    });

    // Demo Buttons (en login de negocio)
    document.querySelectorAll('.quick-demo-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const emailInput = document.getElementById('biz-log-email');
        const passInput = document.getElementById('biz-log-password');
        if (emailInput && passInput) {
          emailInput.value = btn.getAttribute('data-email');
          passInput.value = btn.getAttribute('data-pass');
          document.getElementById('auth-biz-login-form')?.dispatchEvent(new Event('submit'));
        }
      });
    });

    // Real-time password validation for Client Registration
    const cliRegPass = document.getElementById('cli-reg-password');
    const cliRegPassConf = document.getElementById('cli-reg-password-confirm');
    const cliRegErrBox = document.getElementById('cli-reg-inline-error');

    const checkCliPasswordsMatch = () => {
      if (!cliRegPass || !cliRegPassConf || !cliRegErrBox) return true;
      const p1 = cliRegPass.value;
      const p2 = cliRegPassConf.value;

      if (!p1 && !p2) {
        cliRegErrBox.className = 'hidden';
        cliRegPass.classList.remove('border-rose-500', 'bg-rose-50/20', 'border-emerald-500', 'bg-emerald-50/20');
        cliRegPassConf.classList.remove('border-rose-500', 'bg-rose-50/20', 'border-emerald-500', 'bg-emerald-50/20');
        return true;
      }

      if (p2.length > 0 && p1 !== p2) {
        cliRegErrBox.className = 'p-3 bg-rose-50 border border-rose-300 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in';
        cliRegErrBox.innerHTML = '<i class="fas fa-exclamation-circle text-rose-600 text-sm flex-shrink-0"></i> <span>Las contraseñas no coinciden. Por favor verifícalas.</span>';
        cliRegPassConf.classList.add('border-rose-500', 'bg-rose-50/20');
        cliRegPassConf.classList.remove('border-emerald-500', 'bg-emerald-50/20');
        return false;
      } else if (p1.length >= 6 && p1 === p2) {
        cliRegErrBox.className = 'p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in';
        cliRegErrBox.innerHTML = '<i class="fas fa-check-circle text-emerald-600 text-sm flex-shrink-0"></i> <span>¡Las contraseñas coinciden!</span>';
        cliRegPass.classList.remove('border-rose-500', 'bg-rose-50/20');
        cliRegPass.classList.add('border-emerald-500', 'bg-emerald-50/20');
        cliRegPassConf.classList.remove('border-rose-500', 'bg-rose-50/20');
        cliRegPassConf.classList.add('border-emerald-500', 'bg-emerald-50/20');
        return true;
      } else if (p1.length > 0 && p1.length < 6) {
        cliRegErrBox.className = 'p-2.5 bg-amber-50 border border-amber-300 text-amber-800 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in';
        cliRegErrBox.innerHTML = '<i class="fas fa-info-circle text-amber-600 text-sm flex-shrink-0"></i> <span>La contraseña debe tener al menos 6 caracteres.</span>';
        return false;
      } else {
        cliRegErrBox.className = 'hidden';
        cliRegPass.classList.remove('border-rose-500', 'bg-rose-50/20');
        cliRegPassConf.classList.remove('border-rose-500', 'bg-rose-50/20');
        return true;
      }
    };

    cliRegPass?.addEventListener('input', checkCliPasswordsMatch);
    cliRegPassConf?.addEventListener('input', checkCliPasswordsMatch);

    // Real-time password validation for Business Registration
    const bizRegPass = document.getElementById('reg-biz-password');
    const bizRegPassConf = document.getElementById('reg-biz-password-confirm');
    const bizRegErrBox = document.getElementById('biz-reg-inline-error');

    const checkBizPasswordsMatch = () => {
      if (!bizRegPass || !bizRegPassConf || !bizRegErrBox) return true;
      const p1 = bizRegPass.value;
      const p2 = bizRegPassConf.value;

      if (!p1 && !p2) {
        bizRegErrBox.className = 'hidden';
        bizRegPass.classList.remove('border-rose-500', 'bg-rose-50/20', 'border-emerald-500', 'bg-emerald-50/20');
        bizRegPassConf.classList.remove('border-rose-500', 'bg-rose-50/20', 'border-emerald-500', 'bg-emerald-50/20');
        return true;
      }

      if (p2.length > 0 && p1 !== p2) {
        bizRegErrBox.className = 'p-3 bg-rose-50 border border-rose-300 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in';
        bizRegErrBox.innerHTML = '<i class="fas fa-exclamation-circle text-rose-600 text-sm flex-shrink-0"></i> <span>Las contraseñas no coinciden. Por favor verifícalas.</span>';
        bizRegPassConf.classList.add('border-rose-500', 'bg-rose-50/20');
        bizRegPassConf.classList.remove('border-emerald-500', 'bg-emerald-50/20');
        return false;
      } else if (p1.length >= 6 && p1 === p2) {
        bizRegErrBox.className = 'p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in';
        bizRegErrBox.innerHTML = '<i class="fas fa-check-circle text-emerald-600 text-sm flex-shrink-0"></i> <span>¡Las contraseñas coinciden!</span>';
        bizRegPass.classList.remove('border-rose-500', 'bg-rose-50/20');
        bizRegPass.classList.add('border-emerald-500', 'bg-emerald-50/20');
        bizRegPassConf.classList.remove('border-rose-500', 'bg-rose-50/20');
        bizRegPassConf.classList.add('border-emerald-500', 'bg-emerald-50/20');
        return true;
      } else if (p1.length > 0 && p1.length < 6) {
        bizRegErrBox.className = 'p-2.5 bg-amber-50 border border-amber-300 text-amber-800 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in';
        bizRegErrBox.innerHTML = '<i class="fas fa-info-circle text-amber-600 text-sm flex-shrink-0"></i> <span>La contraseña debe tener al menos 6 caracteres.</span>';
        return false;
      } else {
        bizRegErrBox.className = 'hidden';
        bizRegPass.classList.remove('border-rose-500', 'bg-rose-50/20');
        bizRegPassConf.classList.remove('border-rose-500', 'bg-rose-50/20');
        return true;
      }
    };

    bizRegPass?.addEventListener('input', checkBizPasswordsMatch);
    bizRegPassConf?.addEventListener('input', checkBizPasswordsMatch);

    // Evento Submit: Login Cliente
    document.getElementById('auth-client-login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const identifier = document.getElementById('cli-log-identifier').value.trim();
      const password = document.getElementById('cli-log-password').value;
      const errBox = document.getElementById('cli-log-inline-error');

      try {
        if (errBox) errBox.className = 'hidden';
        const res = await storage.loginClient(identifier, password);
        
        if (res && res.role === 'developer') {
          this.showToast('¡Modo SuperAdmin Developer activado!', 'success');
          modalContainer.innerHTML = '';
          this.renderHeader();
          this.navigateTo('developer-dashboard');
          return;
        }

        if (res && res.role === 'business') {
          this.showToast('¡Bienvenido a tu panel de administración!', 'success');
          modalContainer.innerHTML = '';
          this.renderHeader();
          this.navigateTo('owner-dashboard');
          return;
        }

        this.showToast('¡Bienvenido(a)! Sesión iniciada como cliente.', 'success');
        modalContainer.innerHTML = '';
        this.renderHeader();
        this.renderCurrentView();
      } catch (err) {
        this.showToast(err.message || 'Error al iniciar sesión.', 'error');
        if (errBox) {
          errBox.className = 'p-3 bg-rose-50 border border-rose-300 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in mb-3';
          errBox.innerHTML = `<i class="fas fa-exclamation-circle text-rose-600 text-sm flex-shrink-0"></i> <span>${err.message || 'Error al iniciar sesión.'}</span>`;
        }
      }
    });

    // Evento Submit: Registro Cliente
    document.getElementById('auth-client-reg-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('cli-reg-name').value.trim();
      const phone = document.getElementById('cli-reg-phone').value.trim();
      const email = document.getElementById('cli-reg-email').value.trim();
      const password = document.getElementById('cli-reg-password').value;
      const passwordConfirm = document.getElementById('cli-reg-password-confirm').value;
      const errBox = document.getElementById('cli-reg-inline-error');

      if (password.length < 6) {
        this.showToast('La contraseña debe tener al menos 6 caracteres.', 'error');
        if (errBox) {
          errBox.className = 'p-3 bg-rose-50 border border-rose-300 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in';
          errBox.innerHTML = '<i class="fas fa-exclamation-circle text-rose-600 text-sm flex-shrink-0"></i> <span>La contraseña debe tener al menos 6 caracteres.</span>';
        }
        document.getElementById('cli-reg-password').focus();
        return;
      }

      if (password !== passwordConfirm) {
        this.showToast('Las contraseñas no coinciden. Por favor verifícalas.', 'error');
        document.getElementById('cli-reg-password-confirm').focus();
        if (errBox) {
          errBox.className = 'p-3 bg-rose-50 border border-rose-300 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in';
          errBox.innerHTML = '<i class="fas fa-exclamation-triangle text-rose-600 text-sm flex-shrink-0"></i> <span>Las contraseñas no coinciden. Por favor verifícalas aquí arriba.</span>';
        }
        const confirmInput = document.getElementById('cli-reg-password-confirm');
        confirmInput.classList.add('border-rose-500', 'bg-rose-50/20');
        confirmInput.focus();
        return;
      }

      const whatsappOptIn = document.getElementById('cli-reg-whatsapp-optin')?.checked ?? true;

      try {
        await storage.registerClient(name, phone, email, password, whatsappOptIn);
        this.showToast('¡Cuenta de cliente creada exitosamente!', 'success');
        modalContainer.innerHTML = '';
        this.renderHeader();
        this.renderCurrentView();
      } catch (err) {
        this.showToast(err.message || 'Error al registrarse.', 'error');
        if (errBox) {
          errBox.className = 'p-3 bg-rose-50 border border-rose-300 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in';
          errBox.innerHTML = `<i class="fas fa-exclamation-circle text-rose-600 text-sm flex-shrink-0"></i> <span>${err.message || 'Error al registrarse.'}</span>`;
        }
      }
    });

    // Evento Submit: Login Negocio
    document.getElementById('auth-biz-login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('biz-log-email').value;
      const password = document.getElementById('biz-log-password').value;
      const errBox = document.getElementById('biz-log-inline-error');

      try {
        if (errBox) errBox.className = 'hidden';
        const res = await storage.loginBusiness(email, password);

        if (res && res.role === 'developer') {
          this.showToast('¡Modo SuperAdmin Developer activado!', 'success');
          modalContainer.innerHTML = '';
          this.renderHeader();
          this.navigateTo('developer-dashboard');
          return;
        }

        if (res && res.role === 'client') {
          this.showToast('¡Bienvenido(a)! Sesión iniciada como cliente.', 'success');
          modalContainer.innerHTML = '';
          this.renderHeader();
          this.navigateTo('my-client-bookings');
          return;
        }

        this.showToast('¡Bienvenido a tu panel de administración!', 'success');
        modalContainer.innerHTML = '';
        this.renderHeader();
        this.navigateTo('owner-dashboard');
      } catch (err) {
        this.showToast(err.message || 'Error al iniciar sesión.', 'error');
        if (errBox) {
          errBox.className = 'p-3 bg-rose-50 border border-rose-300 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in mb-3';
          errBox.innerHTML = `<i class="fas fa-exclamation-circle text-rose-600 text-sm flex-shrink-0"></i> <span>${err.message || 'Error al iniciar sesión.'}</span>`;
        }
      }
    });

    // Evento Submit: Registro Negocio (Con Selección de Plan)
    document.getElementById('auth-biz-reg-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ownerName = document.getElementById('reg-owner-name').value;
      const email = document.getElementById('reg-biz-email').value;
      const password = document.getElementById('reg-biz-password').value;
      const passwordConfirm = document.getElementById('reg-biz-password-confirm').value;
      const name = document.getElementById('new-biz-name').value;
      const catSelectVal = document.getElementById('new-biz-cat').value;
      const city = document.getElementById('new-biz-city').value;
      const phone = document.getElementById('new-biz-phone').value;
      const address = document.getElementById('new-biz-address').value;
      const description = document.getElementById('new-biz-desc').value;
      const image = document.getElementById('new-biz-image').value;
      const coverImage = document.getElementById('new-biz-cover').value;
      const firstSrvName = document.getElementById('first-srv-name').value;
      const firstSrvPrice = document.getElementById('first-srv-price').value;
      const instagram = document.getElementById('new-biz-instagram')?.value.trim() || '';
      const facebook = document.getElementById('new-biz-facebook')?.value.trim() || '';
      const tiktok = document.getElementById('new-biz-tiktok')?.value.trim() || '';
      const website = document.getElementById('new-biz-website')?.value.trim() || '';
      const socialLinks = { instagram, facebook, tiktok, website };
      const errBox = document.getElementById('biz-reg-inline-error');

      // Plan de suscripción elegido
      const chosenPlanRadio = document.querySelector('input[name="new-biz-plan"]:checked');
      const chosenPlanId = chosenPlanRadio ? chosenPlanRadio.value : 'basic';
      const planConfig = storage.getPlanById(chosenPlanId);

      if (password.length < 6) {
        this.showToast('La contraseña debe tener al menos 6 caracteres.', 'error');
        if (errBox) {
          errBox.className = 'p-3 bg-rose-50 border border-rose-300 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in';
          errBox.innerHTML = '<i class="fas fa-exclamation-circle text-rose-600 text-sm flex-shrink-0"></i> <span>La contraseña debe tener al menos 6 caracteres.</span>';
        }
        document.getElementById('reg-biz-password').focus();
        return;
      }

      if (password !== passwordConfirm) {
        this.showToast('Las contraseñas no coinciden. Por favor verifícalas.', 'error');
        document.getElementById('reg-biz-password-confirm').focus();
        if (errBox) {
          errBox.className = 'p-3 bg-rose-50 border border-rose-300 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in';
          errBox.innerHTML = '<i class="fas fa-exclamation-triangle text-rose-600 text-sm flex-shrink-0"></i> <span>Las contraseñas no coinciden. Por favor verifícalas aquí arriba.</span>';
        }
        const confirmInput = document.getElementById('reg-biz-password-confirm');
        confirmInput.classList.add('border-rose-500', 'bg-rose-50/20');
        confirmInput.focus();
        return;
      }

      // Procesar Categoría (Estándar o Personalizada)
      let finalCategory = catSelectVal;
      let categoryLabel = '';
      let isCustomCategory = false;

      if (catSelectVal === 'otra') {
        const customName = document.getElementById('new-biz-custom-cat')?.value.trim();
        if (!customName) {
          this.showToast('Por favor escribe el nombre de tu categoría personalizada.', 'error');
          document.getElementById('new-biz-custom-cat')?.focus();
          return;
        }
        finalCategory = customName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        if (!finalCategory) finalCategory = `cat-${Date.now()}`;
        categoryLabel = customName;
        isCustomCategory = true;
      } else {
        const catObj = storage.getCategories().find(c => c.id === catSelectVal);
        categoryLabel = catObj ? catObj.name : catSelectVal;
      }

      // Método de pago seleccionado
      const chosenPayRadio = document.querySelector('input[name="new-biz-paymethod"]:checked');
      const chosenPayMethod = chosenPayRadio ? chosenPayRadio.value : 'sinpe';
      const isSinpe = chosenPayMethod === 'sinpe';

      try {
        const regData = await storage.registerBusinessWithUser(ownerName, email, password, {
          name,
          category: finalCategory,
          categoryLabel,
          isCustomCategory,
          plan: planConfig.id,
          planPriceUsd: planConfig.priceUsd,
          monthlyBookingLimit: planConfig.bookingLimit,
          subscriptionStatus: isSinpe ? 'pending_sinpe' : 'pending_payment',
          paymentMethod: isSinpe ? 'sinpe_movil' : 'paypal',
          city,
          phone,
          email,
          address,
          description,
          image: image || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80',
          coverImage: coverImage || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80',
          isDemo: false,
          features: ['Sinpe Móvil', 'Atención Personalizada'],
          socialLinks,
          services: [
            { name: firstSrvName, duration: 30, price: parseFloat(firstSrvPrice) || 10000, description: 'Servicio principal.' }
          ]
        });

        modalContainer.innerHTML = '';
        this.renderHeader();
        this.navigateTo('owner-dashboard');

        const createdBizId = regData?.user?.businessId || storage.getActiveBusinessId();
        if (createdBizId) {
          if (isSinpe) {
            this.showToast(`¡Negocio creado con éxito! Realiza tu SINPE para activar tu ${planConfig.name}`, 'success');
            this.renderSinpePaymentModal({ businessId: createdBizId, planId: planConfig.id });
          } else {
            this.showToast(`¡Negocio creado! Conectando con la pasarela para activar tu ${planConfig.name}...`, 'success');
            this.renderPayPalCheckoutModal({ businessId: createdBizId, planId: planConfig.id });
          }
        }
      } catch (err) {
        this.showToast(err.message || 'Error al registrar negocio.', 'error');
        if (errBox) {
          errBox.className = 'p-3 bg-rose-50 border border-rose-300 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in';
          errBox.innerHTML = `<i class="fas fa-exclamation-circle text-rose-600 text-sm flex-shrink-0"></i> <span>${err.message || 'Error al registrar negocio.'}</span>`;
        }
      }
    });
  }

  // ==========================================
  // MODAL DE PRE-REGISTRO DE COMERCIOS (ACCESO ANTICIPADO)
  // ==========================================
  renderPreRegistrationModal(selectedPlanId = 'pro') {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const categories = storage.getCategories().filter(c => c.id !== 'all');
    const plans = storage.getSubscriptionPlans();

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 modal-backdrop animate-fade-in overflow-y-auto">
        <div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 my-6 modal-card flex flex-col max-h-[92vh]">
          
          <!-- Header del Modal -->
          <div class="p-5 sm:p-6 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white relative shrink-0 border-b border-indigo-900/50">
            <button id="close-prereg-modal-btn" class="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer">
              <i class="fas fa-times text-xs"></i>
            </button>
            
            <div class="flex items-center gap-2 mb-1.5">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-black uppercase tracking-wider border border-amber-400/40">
                <i class="fas fa-rocket"></i> Acceso Anticipado Costa Rica 🇨🇷
              </span>
            </div>

            <h3 class="text-lg sm:text-xl font-black text-white">Pre-registra tu Negocio</h3>
            <p class="text-xs text-slate-300 mt-1 leading-relaxed">Asegura tu lugar entre los primeros 20 comercios y recibe <strong>15 días gratis de bienvenida</strong> + <strong>configuración de catálogo asistida</strong>.</p>
          </div>

          <!-- Beneficio Highlight -->
          <div class="bg-amber-50/90 border-b border-amber-200 px-5 py-2.5 flex items-center gap-2.5 text-xs text-amber-950 font-semibold shrink-0">
            <span class="text-base flex-shrink-0">🎁</span>
            <span><strong>Sin pagos hoy:</strong> Te contactaremos por WhatsApp antes del estreno oficial para activar tu cuenta.</span>
          </div>

          <!-- Formulario de Captura -->
          <form id="prereg-form" class="p-5 sm:p-6 space-y-3.5 text-xs overflow-y-auto flex-1 bg-slate-50/50">
            
            <div>
              <label class="block font-black text-slate-800 mb-1">Nombre Comercial del Negocio o Profesional *</label>
              <input type="text" id="prereg-biz-name" required placeholder="Ej: Barbería Don Juan, Dra. Andrea Soto..." class="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs">
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-black text-slate-800 mb-1">Nombre del Encargado / Dueño *</label>
                <input type="text" id="prereg-contact-name" required placeholder="Tu nombre y apellido" class="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs">
              </div>

              <div>
                <label class="block font-black text-slate-800 mb-1">WhatsApp de Contacto *</label>
                <div class="relative">
                  <span class="absolute left-3 top-2.5 font-bold text-slate-500 text-xs pointer-events-none">🇨🇷 +506</span>
                  <input type="tel" id="prereg-phone" required placeholder="8888-8888" class="w-full pl-20 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-2xs">
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-black text-slate-800 mb-1">Categoría del Negocio *</label>
                <select id="prereg-category" required class="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs">
                  ${categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                  <option value="Otro Servicio">Otro Tipo de Servicio</option>
                </select>
              </div>

              <div>
                <label class="block font-black text-slate-800 mb-1">Cantón o Ciudad</label>
                <input type="text" id="prereg-city" placeholder="Ej: San José, Heredia, Alajuela..." class="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs">
              </div>
            </div>

            <!-- Selección de Plan de Interés -->
            <div>
              <label class="block font-black text-slate-800 mb-1.5">Plan de mayor interés (Suscripción fija mensual):</label>
              <div class="grid grid-cols-3 gap-2">
                ${plans.map(p => `
                  <label class="cursor-pointer">
                    <input type="radio" name="prereg-plan" value="${p.id}" class="sr-only peer" ${p.id === selectedPlanId ? 'checked' : ''}>
                    <div class="p-2.5 rounded-xl border-2 border-slate-200 bg-white peer-checked:border-amber-500 peer-checked:bg-amber-50/50 peer-checked:shadow-sm text-center transition-all flex flex-col items-center justify-between h-full">
                      <span class="font-black text-slate-900 text-[11px] block truncate w-full">${p.name}</span>
                      <span class="text-amber-600 font-black text-sm my-0.5">$${p.priceUsd}<span class="text-[9px] text-slate-500 font-normal">/mes</span></span>
                      <span class="text-[9px] text-slate-500 font-medium leading-none">${p.bookingLimit === 999999 ? 'Ilimitado' : p.bookingLimit + ' reservas'}</span>
                    </div>
                  </label>
                `).join('')}
              </div>
            </div>

            <div id="prereg-error-box" class="hidden p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold"></div>

            <button type="submit" id="prereg-submit-btn" class="w-full py-3.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 rounded-2xl text-xs sm:text-sm font-black shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 cursor-pointer app-touch-btn">
              <i class="fas fa-check-circle text-sm"></i>
              <span>Asegurar mis 15 Días Gratis y Pre-registro</span>
            </button>
            
            <p class="text-[10px] text-slate-400 text-center leading-tight">
              🔒 Tus datos son confidenciales y solo se usarán para coordinar tu acceso prioritario en Costa Rica.
            </p>
          </form>
        </div>
      </div>
    `;

    document.getElementById('close-prereg-modal-btn')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
    });

    document.getElementById('prereg-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('prereg-submit-btn');
      const errBox = document.getElementById('prereg-error-box');
      const bizName = document.getElementById('prereg-biz-name').value.trim();
      const contactName = document.getElementById('prereg-contact-name').value.trim();
      const phone = document.getElementById('prereg-phone').value.trim();
      const category = document.getElementById('prereg-category').value.trim();
      const city = document.getElementById('prereg-city').value.trim();
      const planInterest = document.querySelector('input[name="prereg-plan"]:checked')?.value || 'pro';

      if (!bizName || !contactName || !phone) {
        if (errBox) {
          errBox.classList.remove('hidden');
          errBox.textContent = 'Por favor completa todos los campos obligatorios.';
        }
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Guardando pre-registro...';
      }

      try {
        await storage.savePreRegistration({
          businessName: bizName,
          contactName: contactName,
          phone: phone,
          category: category,
          city: city,
          planInterest: planInterest
        });

        this.showToast('¡Pre-registro completado con éxito! 15 días gratis reservados.', 'success');

        const chosenPlanObj = plans.find(p => p.id === planInterest) || { name: 'Plan Profesional', priceUsd: 15 };

        modalContainer.innerHTML = `
          <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop animate-fade-in">
            <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 my-6 p-6 sm:p-8 text-center space-y-4">
              
              <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-lg shadow-emerald-500/20 animate-bounce">
                <i class="fas fa-check-circle"></i>
              </div>
              
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-[11px] font-black uppercase tracking-wider border border-amber-300">
                🎉 ¡Lugar Reservado con Éxito!
              </span>

              <h3 class="text-xl sm:text-2xl font-black text-slate-900 leading-tight">¡Bienvenido a Reservas CR,<br>${this.escapeHtml(bizName)}!</h3>
              
              <p class="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Has asegurado tus <strong>15 Días Gratis de bienvenida</strong> + <strong>Configuración de catálogo asistida</strong> para el <strong>${chosenPlanObj.name} ($${chosenPlanObj.priceUsd}/mes)</strong>.
              </p>

              <div class="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-left text-xs space-y-1.5 text-emerald-950">
                <div class="flex items-center gap-2 font-black text-emerald-800">
                  <i class="fab fa-whatsapp text-emerald-600 text-base"></i> ¿Qué sigue ahora?
                </div>
                <p class="text-emerald-900 text-[11px] leading-relaxed">
                  Te escribiremos a tu WhatsApp <strong>+506 ${this.escapeHtml(phone)}</strong> antes del estreno para darte acceso prioritario y ayudarte a cargar tus servicios, fotos y horarios.
                </p>
              </div>

              <div class="pt-2 flex flex-col gap-2">
                <button id="close-success-prereg-btn" class="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black shadow-md transition-all cursor-pointer">
                  Entendido, ¡muchas gracias!
                </button>
              </div>
            </div>
          </div>
        `;

        document.getElementById('close-success-prereg-btn')?.addEventListener('click', () => {
          modalContainer.innerHTML = '';
        });
      } catch (err) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fas fa-check-circle text-sm mr-2"></i> Asegurar mis 15 Días Gratis y Pre-registro';
        }
        if (errBox) {
          errBox.classList.remove('hidden');
          errBox.textContent = err.message || 'Error al guardar pre-registro. Intenta de nuevo.';
        }
      }
    });
  }

  // ==========================================
  // MODAL DE PLANES DE SUSCRIPCIÓN ($6, $15, $25)
  // ==========================================
  renderPlansModal({ businessId = null, currentPlanId = 'basic' } = {}) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const plans = storage.getSubscriptionPlans();
    const isOwnerContext = Boolean(businessId);

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop animate-fade-in overflow-y-auto">
        <div class="bg-white rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 my-8 max-h-[92vh] flex flex-col">
          
          <!-- Header -->
          <div class="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 p-6 text-white flex items-center justify-between shrink-0 border-b border-indigo-900/50">
            <div>
              <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-[11px] font-bold uppercase tracking-wider mb-1.5 border border-amber-400/30">
                <i class="fas fa-crown"></i> Planes de Suscripción para Negocios
              </div>
              <h3 class="text-xl sm:text-2xl font-black">Elige el plan ideal para tu comercio</h3>
              <p class="text-xs text-slate-300 mt-0.5">Comienza a recibir reservas en línea y recordatorios automáticos por WhatsApp y correo.</p>
            </div>
            <button id="close-plans-modal-btn" class="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer">
              <i class="fas fa-times text-sm"></i>
            </button>
          </div>

          <!-- Body: Grid de los 3 Planes -->
          <div class="p-6 overflow-y-auto flex-1 bg-slate-50">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
              ${plans.map(plan => {
                const isCurrent = isOwnerContext && (currentPlanId === plan.id);
                const isPro = plan.id === 'pro';
                const isUnlimited = plan.id === 'unlimited';

                return `
                  <div class="relative bg-white rounded-3xl p-6 border-2 ${isPro ? 'border-amber-400 shadow-xl ring-2 ring-amber-400/20' : isUnlimited ? 'border-purple-300 shadow-md' : 'border-slate-200 shadow-sm'} flex flex-col justify-between transition-all duration-300 hover:-translate-y-1">
                    
                    ${plan.badge ? `
                      <div class="absolute -top-3.5 left-1/2 transform -translate-x-1/2">
                        <span class="px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm ${isPro ? 'bg-amber-400 text-slate-950' : isUnlimited ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white'}">
                          ${plan.badge}
                        </span>
                      </div>
                    ` : ''}

                    <div>
                      <div class="flex items-center justify-between mb-2 mt-1">
                        <h4 class="text-lg font-extrabold text-slate-900">${plan.name}</h4>
                        <span class="w-8 h-8 rounded-xl ${isPro ? 'bg-amber-100 text-amber-700' : isUnlimited ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'} flex items-center justify-center text-sm">
                          <i class="fas ${isUnlimited ? 'fa-infinity' : isPro ? 'fa-star' : 'fa-rocket'}"></i>
                        </span>
                      </div>

                      <p class="text-xs text-slate-500 min-h-[36px]">${plan.tagline}</p>

                      <!-- Precio -->
                      <div class="mt-4 pb-4 border-b border-slate-100">
                        <div class="flex items-baseline gap-1">
                          <span class="text-3xl sm:text-4xl font-black text-slate-900">$${plan.priceUsd}</span>
                          <span class="text-xs text-slate-500 font-semibold">USD / mes</span>
                        </div>
                        <span class="text-xs text-slate-500 block font-medium mt-0.5">
                          ~${this.formatColones(plan.priceCrc)} CRC / mes
                        </span>
                        
                        <!-- Límite de reservas badge -->
                        <div class="mt-3 p-2.5 rounded-xl ${isPro ? 'bg-amber-50 text-amber-900 border border-amber-200' : isUnlimited ? 'bg-purple-50 text-purple-900 border border-purple-200' : 'bg-blue-50 text-blue-900 border border-blue-200'} text-xs font-bold flex items-center justify-center gap-1.5">
                          <i class="fas ${isUnlimited ? 'fa-infinity' : 'fa-calendar-check'}"></i>
                          <span>${plan.bookingLimitLabel}</span>
                        </div>
                      </div>

                      <!-- Lista de Beneficios -->
                      <ul class="mt-4 space-y-2.5 text-xs text-slate-600">
                        ${plan.features.map(f => `
                          <li class="flex items-start gap-2">
                            <i class="fas fa-check-circle text-emerald-500 mt-0.5 text-xs flex-shrink-0"></i>
                            <span>${f}</span>
                          </li>
                        `).join('')}
                      </ul>
                    </div>

                    <!-- Botones de Acción: Suscribirme (Tarjeta/PayPal) y Pagar con SINPE Móvil -->
                    <div class="mt-6 pt-4 border-t border-slate-100 space-y-2">
                      ${isCurrent ? `
                        <button disabled class="w-full py-3.5 bg-emerald-100 text-emerald-800 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 cursor-default">
                          <i class="fas fa-check-circle"></i> Tu Plan Actual
                        </button>
                      ` : `
                        <button 
                          class="select-plan-paypal-btn w-full py-3.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 text-slate-950 font-black rounded-2xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 cursor-pointer app-touch-btn"
                          data-plan-id="${plan.id}"
                        >
                          <i class="fas fa-credit-card text-xs"></i>
                          <span>Suscribirme ($${plan.priceUsd}${plan.interval === 'cada 24 horas' ? '/24h' : '/mes'})</span>
                          <i class="fas fa-arrow-right text-xs"></i>
                        </button>

                        <button 
                          class="select-plan-sinpe-btn w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black rounded-2xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 cursor-pointer app-touch-btn"
                          data-plan-id="${plan.id}"
                        >
                          <i class="fas fa-mobile-alt text-sm"></i>
                          <span>Pagar con SINPE Móvil (~${this.formatColones(plan.priceCrc)})</span>
                        </button>
                      `}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Footer Seguro -->
          <div class="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 shrink-0">
            <div class="flex items-center gap-2">
              <i class="fas fa-shield-alt text-emerald-600 text-sm"></i>
              <span>Sin contratos forzosos. Cancela o cambia de plan en cualquier momento.</span>
            </div>
            <span class="font-bold text-slate-700">Aceptamos SINPE Móvil, Tarjetas y PayPal en Costa Rica 🇨🇷</span>
          </div>
        </div>
      </div>
    `;

    document.getElementById('close-plans-modal-btn')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
    });

    // Acción: Suscribirse con Tarjeta / PayPal
    document.querySelectorAll('.select-plan-paypal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const planId = btn.getAttribute('data-plan-id');
        const bizUser = storage.getBusinessUser();
        const activeBizId = businessId || (bizUser ? bizUser.businessId : null);
        modalContainer.innerHTML = '';

        if (activeBizId) {
          this.renderPayPalCheckoutModal({ businessId: activeBizId, planId });
        } else {
          this.showToast('Primero crea la cuenta de tu negocio para asociarle tu plan.', 'info');
          this.renderAuthModal({ mode: 'register', role: 'business', selectedPlanId: planId });
        }
      });
    });

    // Acción: Pagar con SINPE Móvil
    document.querySelectorAll('.select-plan-sinpe-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const planId = btn.getAttribute('data-plan-id');
        const bizUser = storage.getBusinessUser();
        const activeBizId = businessId || (bizUser ? bizUser.businessId : null);
        modalContainer.innerHTML = '';

        if (activeBizId) {
          this.renderSinpePaymentModal({ businessId: activeBizId, planId });
        } else {
          this.showToast('Primero crea la cuenta de tu negocio para asociarle tu plan.', 'info');
          this.renderAuthModal({ mode: 'register', role: 'business', selectedPlanId: planId });
        }
      });
    });
  }

  // ==========================================
  // MODAL DE PAGO CON SINPE MÓVIL (COSTA RICA)
  // ==========================================
  renderSinpePaymentModal({ businessId, planId = 'basic' }) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const plan = storage.getPlanById(planId) || { name: 'Plan Básico', priceUsd: 10, priceCrc: 5200, bookingLimitLabel: 'Hasta 150 reservas/mes' };
    const biz = businessId ? storage.getBusinessById(businessId) : null;
    const bizName = biz ? biz.name : 'Mi Negocio';
    const sinpePhoneFormatted = '7143-3852';
    const sinpePhoneRaw = '71433852';
    const sinpeTitular = 'Juan Jose Jiménez';
    const amountCrc = this.formatColones(plan.priceCrc || (plan.priceUsd * 530));
    const amountUsd = `$${plan.priceUsd} USD`;
    const isTestPlan = plan.id === 'test';

    const whatsappMessage = `Hola Juan José, adjunto comprobante SINPE Móvil por ${amountCrc} para activar el ${plan.name} (${amountUsd}) del comercio "${bizName}"${businessId ? ` (ID: ${businessId})` : ''}.`;
    const whatsappUrl = `https://wa.me/50671433852?text=${encodeURIComponent(whatsappMessage)}`;

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop animate-fade-in overflow-y-auto">
        <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 my-6 modal-card flex flex-col">
          
          <!-- Header -->
          <div class="p-6 bg-gradient-to-r from-emerald-900 via-teal-950 to-slate-900 text-white relative border-b border-emerald-800/40">
            <button id="close-sinpe-modal-btn" class="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer">
              <i class="fas fa-times text-xs"></i>
            </button>
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-400/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider mb-2 border border-emerald-400/30">
              <i class="fas fa-mobile-alt"></i> Pago Oficial Costa Rica 🇨🇷
            </div>
            <h3 class="text-xl font-black text-white">Pago con SINPE Móvil</h3>
            <p class="text-xs text-emerald-100/90 mt-0.5">Activa tu suscripción de forma rápida y directa.</p>
          </div>

          <!-- Resumen del Plan -->
          <div class="p-4 bg-emerald-50/70 border-b border-emerald-100 space-y-2 text-xs">
            <div class="flex items-center justify-between">
              <span class="text-slate-600 font-semibold">Comercio:</span>
              <strong class="text-slate-900 font-black">${this.escapeHtml(bizName)}</strong>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-600 font-semibold">Plan Seleccionado:</span>
              <span class="px-2.5 py-0.5 rounded-md bg-emerald-200 text-emerald-950 font-bold">${plan.name}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-600 font-semibold">Monto a Transferir:</span>
              <span class="text-base font-black text-emerald-700">${amountCrc} CRC <span class="text-xs font-normal text-slate-500">(${amountUsd})</span></span>
            </div>
            <div class="flex items-center justify-between text-[11px] text-slate-500">
              <span>Frecuencia:</span>
              <span class="font-bold text-slate-700">${isTestPlan ? 'Prueba 24 Horas' : 'Mensual (30 Días)'}</span>
            </div>
          </div>

          <!-- Datos de Transferencia SINPE Móvil -->
          <div class="p-5 space-y-4 text-xs">
            <div class="p-4 rounded-2xl bg-slate-900 text-white space-y-3 shadow-md border border-slate-800">
              <div class="flex items-center justify-between text-slate-400 text-[11px] uppercase tracking-wider font-bold">
                <span><i class="fas fa-university mr-1 text-emerald-400"></i> Datos del SINPE Móvil</span>
                <span class="text-emerald-400">Paso 1 de 2</span>
              </div>
              
              <!-- Número SINPE con Copiado -->
              <div class="flex items-center justify-between bg-slate-800/90 p-3 rounded-xl border border-slate-700">
                <div>
                  <span class="text-[10px] text-slate-400 block font-medium">Número de Teléfono:</span>
                  <span class="text-lg font-mono font-black text-emerald-400 tracking-wider" id="sinpe-phone-display">${sinpePhoneFormatted}</span>
                </div>
                <button id="copy-sinpe-phone-btn" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs">
                  <i class="fas fa-copy"></i>
                  <span>Copiar</span>
                </button>
              </div>

              <!-- Titular -->
              <div class="bg-slate-800/90 p-3 rounded-xl border border-slate-700">
                <span class="text-[10px] text-slate-400 block font-medium">Nombre del Titular:</span>
                <span class="text-sm font-black text-white">${sinpeTitular}</span>
              </div>
            </div>

            <!-- Paso 2: Instrucción de WhatsApp -->
            <div class="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 space-y-2">
              <div class="flex items-start gap-2.5">
                <i class="fab fa-whatsapp text-emerald-600 text-lg flex-shrink-0 mt-0.5"></i>
                <div class="space-y-1">
                  <span class="font-black text-xs block text-slate-900 uppercase tracking-wide">Paso 2: Envío de Comprobante</span>
                  <p class="text-xs text-slate-700 leading-relaxed">
                    Cuando realices el SINPE envía el comprobante de pago al mismo número de WhatsApp del SINPE (<strong>${sinpePhoneFormatted}</strong>) para la activación de la cuenta.
                  </p>
                </div>
              </div>
            </div>

            <!-- Botones de Acción -->
            <div class="space-y-2 pt-1">
              <a 
                href="${whatsappUrl}" 
                target="_blank" 
                id="sinpe-send-whatsapp-btn" 
                class="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
              >
                <i class="fab fa-whatsapp text-base"></i>
                <span>Enviar Comprobante por WhatsApp</span>
                <i class="fas fa-arrow-right text-xs"></i>
              </a>

              <button 
                id="sinpe-done-btn" 
                class="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all cursor-pointer"
              >
                Entendido, ya realicé la transferencia
              </button>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-5 py-3 bg-slate-50 border-t border-slate-100 text-center text-[11px] text-slate-400">
            Tu plan se activará en cuanto el comprobante sea verificado.
          </div>
        </div>
      </div>
    `;

    document.getElementById('close-sinpe-modal-btn')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
    });

    document.getElementById('sinpe-done-btn')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
      this.showToast('¡Comprobante en proceso de verificación! Te contactaremos por WhatsApp.', 'success');
      if (this.currentView === 'owner-dashboard') {
        this.renderCurrentView();
      }
    });

    document.getElementById('copy-sinpe-phone-btn')?.addEventListener('click', () => {
      navigator.clipboard.writeText(sinpePhoneRaw).then(() => {
        this.showToast('¡Número SINPE copiado: 7143-3852!', 'success');
      }).catch(() => {
        this.showToast('Número: 7143-3852', 'info');
      });
    });
  }

  // ==========================================
  // MODAL DE PAGO / ACTIVACIÓN CON PAYPAL Y TARJETA
  // ==========================================
  async renderPayPalCheckoutModal({ businessId, planId = 'pro' }) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const plan = storage.getPlanById(planId) || { name: 'Plan Profesional', priceUsd: 18, priceCrc: 9400, bookingLimitLabel: 'Hasta 300 reservas/mes' };
    const biz = businessId ? storage.getBusinessById(businessId) : null;
    const isTestPlan = plan.id === 'test';
    const durationLabel = isTestPlan ? '24 Horas' : '30 Días';
    const amountCrc = this.formatColones(plan.priceCrc || (plan.priceUsd * 530));

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop animate-fade-in overflow-y-auto">
        <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 my-6 modal-card flex flex-col">
          
          <!-- Header -->
          <div class="p-6 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white relative border-b border-indigo-900/50">
            <button id="close-paypal-modal-btn" class="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer">
              <i class="fas fa-times text-xs"></i>
            </button>
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-black uppercase tracking-wider mb-2 border border-amber-400/30">
              <i class="fab fa-paypal"></i> Pasarela de Pago Seguro
            </div>
            <h3 class="text-xl font-black text-white">Activar ${plan.name}</h3>
            <p class="text-xs text-slate-300 mt-0.5">Pago por período de <strong>${durationLabel}</strong> &bull; <strong>$${plan.priceUsd} USD</strong> (~${amountCrc} CRC)</p>
          </div>

          <!-- Resumen del Comercio y Plan -->
          <div class="p-5 bg-slate-50 border-b border-slate-200 space-y-2 text-xs">
            <div class="flex items-center justify-between">
              <span class="text-slate-500 font-semibold">Comercio:</span>
              <strong class="text-slate-900 font-black">${biz ? this.escapeHtml(biz.name) : 'Tu Comercio'}</strong>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500 font-semibold">Plan seleccionado:</span>
              <span class="px-2.5 py-0.5 rounded-md ${isTestPlan ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'} font-bold">${plan.name} ($${plan.priceUsd})</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500 font-semibold">Duración activa:</span>
              <span class="text-slate-900 font-bold">${durationLabel} <span class="text-slate-400 font-normal">(renovación manual mes a mes)</span></span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500 font-semibold">Límite:</span>
              <span class="text-emerald-700 font-bold">${plan.bookingLimitLabel}</span>
            </div>
          </div>

          <!-- Contenedor de Botones de PayPal / Tarjeta -->
          <div class="p-6 space-y-4">
            
            <!-- Guía Rápida: Pagar con Tarjeta -->
            <div class="p-3.5 bg-blue-50/90 border border-blue-200 rounded-2xl text-[11px] text-blue-950 flex items-start gap-2.5">
              <div class="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xs flex-shrink-0 mt-0.5 shadow-xs">
                <i class="fas fa-credit-card"></i>
              </div>
              <div class="space-y-0.5">
                <strong class="block text-blue-950 font-bold text-xs">Pago Rápido con Tarjeta o PayPal</strong>
                <p class="text-slate-600 leading-tight">
                  Paga directamente con tu tarjeta de débito/crédito (Visa, Mastercard, AMEX) o con tu cuenta PayPal. Sin cobros automáticos imprevistos.
                </p>
              </div>
            </div>

            <div id="paypal-loading-spinner" class="py-8 flex flex-col items-center justify-center text-slate-500 gap-2">
              <i class="fas fa-circle-notch fa-spin text-2xl text-blue-600"></i>
              <span class="text-xs font-semibold">Cargando pasarela de pago seguro...</span>
            </div>

            <div id="paypal-button-wrapper" class="transition-all duration-300">
              <div id="paypal-button-container" class="min-h-[120px]"></div>
            </div>

            <div id="paypal-error-box" class="hidden p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold"></div>

            <!-- Alternativa Local: SINPE Móvil -->
            <div class="pt-3 border-t border-slate-200 text-center space-y-2">
              <span class="text-[11px] text-slate-500 block font-medium">¿Prefieres pagar por transferencia local en Costa Rica?</span>
              <button 
                type="button" 
                id="paypal-switch-to-sinpe-btn" 
                class="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <i class="fas fa-mobile-alt text-emerald-600"></i>
                <span>Pagar con SINPE Móvil (~${amountCrc} CRC)</span>
              </button>
            </div>

            <div class="pt-1 text-[11px] text-slate-400 text-center leading-tight flex items-center justify-center gap-1.5">
              <i class="fas fa-shield-alt text-emerald-600"></i>
              <span>Procesado de forma 100% segura por PayPal. Pago único sin cargos automáticos.</span>
            </div>
          </div>

        </div>
      </div>
    `;

    document.getElementById('close-paypal-modal-btn')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
    });

    document.getElementById('paypal-switch-to-sinpe-btn')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
      this.renderSinpePaymentModal({ businessId, planId });
    });

    try {
      const config = await storage.getPayPalConfig();

      // Cargar SDK dinámico en modo órdenes estándar (pago directo / sin vault recurrente)
      await this.loadPayPalSDK(config.clientId, config.currency || 'USD');

      const spinner = document.getElementById('paypal-loading-spinner');
      if (spinner) spinner.style.display = 'none';

      if (!window.paypal || !window.paypal.Buttons) {
        throw new Error('No se pudo inicializar los componentes de PayPal.');
      }

      window.paypal.Buttons({
        style: {
          shape: 'rect',
          color: 'gold',
          layout: 'vertical',
          label: 'pay',
          tagline: false
        },
        createOrder: async (data, actions) => {
          try {
            const res = await storage.createPayPalOrder(businessId, planId);
            if (res && res.orderId) {
              return res.orderId;
            }
          } catch (e) {
            console.warn('Fallback a client-side createOrder:', e);
          }
          return actions.order.create({
            purchase_units: [{
              amount: {
                value: plan.priceUsd.toString(),
                currency_code: 'USD'
              },
              description: `Activación ${plan.name} - ${durationLabel} (Reservas CR)`
            }]
          });
        },
        onApprove: async (data, actions) => {
          const btnContainer = document.getElementById('paypal-button-container');
          if (btnContainer) {
            btnContainer.innerHTML = `
              <div class="py-8 text-center space-y-2">
                <i class="fas fa-circle-notch fa-spin text-2xl text-emerald-600"></i>
                <p class="text-xs font-bold text-slate-800">Verificando y activando tu plan...</p>
              </div>
            `;
          }

          try {
            await storage.capturePayPalOrder(data.orderID, businessId, planId);
            this.showToast(`¡Plan ${plan.name} activado con éxito!`, 'success');

            modalContainer.innerHTML = `
              <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop animate-fade-in">
                <div class="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 my-6 p-6 text-center space-y-4">
                  <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-lg shadow-emerald-500/20 animate-bounce">
                    <i class="fas fa-check-circle"></i>
                  </div>
                  <h3 class="text-xl font-black text-slate-900">¡Plan Activado!</h3>
                  <p class="text-xs text-slate-600">
                    Tu <strong>${plan.name} ($${plan.priceUsd})</strong> está activo por <strong>${durationLabel}</strong>. Puedes usar todas sus funciones de inmediato. ID de orden: <code>${data.orderID}</code>.
                  </p>
                  <button id="close-paypal-success-btn" class="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-all cursor-pointer">
                    Continuar a mi Panel
                  </button>
                </div>
              </div>
            `;

            document.getElementById('close-paypal-success-btn')?.addEventListener('click', () => {
              modalContainer.innerHTML = '';
              this.renderCurrentView();
            });
          } catch (err) {
            const errBox = document.getElementById('paypal-error-box');
            if (errBox) {
              errBox.classList.remove('hidden');
              errBox.textContent = err.message || 'Error confirmando el pago.';
            }
          }
        },
        onError: (err) => {
          console.error('Error en PayPal Buttons:', err);
          const errBox = document.getElementById('paypal-error-box');
          if (errBox) {
            errBox.classList.remove('hidden');
            errBox.textContent = 'Hubo un inconveniente al procesar con PayPal o Tarjeta. Por favor intenta de nuevo.';
          }
        }
      }).render('#paypal-button-container');

    } catch (err) {
      console.error('Error cargando PayPal:', err);
      const spinner = document.getElementById('paypal-loading-spinner');
      if (spinner) {
        spinner.innerHTML = `
          <div class="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl text-center">
            <i class="fas fa-exclamation-triangle text-rose-600 text-lg mb-1 block"></i>
            <span>${err.message || 'No se pudo cargar la pasarela de PayPal.'}</span>
          </div>
        `;
      }
    }
  }

  // Helper para cargar SDK de PayPal dinámicamente para órdenes directas
  loadPayPalSDK(clientId, currency = 'USD') {
    return new Promise((resolve, reject) => {
      const existingScript = document.getElementById('paypal-sdk-script');
      // If previous script was subscription/vault, replace it with clean direct order SDK
      if (existingScript && window.paypal && !existingScript.src.includes('vault=true')) {
        return resolve(window.paypal);
      }
      if (existingScript) existingScript.remove();
      if (window.paypal) delete window.paypal;

      const script = document.createElement('script');
      script.id = 'paypal-sdk-script';
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${currency}&locale=es_CR&components=buttons`;
      script.onload = () => resolve(window.paypal);
      script.onerror = () => reject(new Error('Error al cargar el script de PayPal SDK.'));
      document.head.appendChild(script);
    });
  }

  // ==========================================
  // MODAL DE MODIFICACIÓN / EDICIÓN DE NEGOCIO
  // ==========================================
  renderEditBusinessModal(businessId) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const biz = storage.getBusinessById(businessId);
    if (!biz) {
      this.showToast('No se encontró el negocio a modificar.', 'error');
      return;
    }

    const categories = storage.getCategories().filter(c => c.id !== 'all');

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 modal-backdrop animate-fade-in overflow-y-auto">
        <div class="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 my-6 modal-card flex flex-col max-h-[92vh]">
          
          <!-- Header -->
          <div class="p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white relative border-b border-slate-800 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-lg shadow-md flex-shrink-0">
                <i class="fas fa-edit"></i>
              </div>
              <div>
                <span class="text-[10px] uppercase tracking-wider text-blue-300 font-extrabold block">Directorio de Comercios</span>
                <h3 class="text-base sm:text-lg font-black text-white">Modificar Datos del Negocio</h3>
              </div>
            </div>
            <button id="close-edit-biz-modal-btn" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer">
              <i class="fas fa-times text-xs"></i>
            </button>
          </div>

          <!-- Formulario con scroll -->
          <form id="edit-business-form" class="p-6 space-y-4 overflow-y-auto text-xs sm:text-sm flex-1">
            
            <!-- ID y Tipo -->
            <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <span class="text-slate-500 font-medium">ID del Comercio: <strong class="font-mono text-slate-800">${biz.id}</strong></span>
              <span class="px-2.5 py-0.5 rounded-md font-bold ${biz.isDemo ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'}">
                ${biz.isDemo ? 'Comercio de Muestra' : 'Comercio Real'}
              </span>
            </div>

            <!-- Nombre y Categoría -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1 text-xs">Nombre del Comercio *</label>
                <input type="text" id="edit-biz-name" value="${this.escapeHtml(biz.name || '')}" required class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none">
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1 text-xs">Categoría Principal *</label>
                <select id="edit-biz-category" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  ${categories.map(c => `
                    <option value="${c.id}" ${biz.category === c.id ? 'selected' : ''}>${c.name}</option>
                  `).join('')}
                </select>
              </div>
            </div>

            <!-- Ciudad y Dirección -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1 text-xs">Ciudad / Cantón (Costa Rica) *</label>
                <input type="text" id="edit-biz-city" value="${this.escapeHtml(biz.city || 'San José')}" required placeholder="Ej. Escazú, San José" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none">
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1 text-xs">Dirección Exacta</label>
                <input type="text" id="edit-biz-address" value="${this.escapeHtml(biz.address || '')}" placeholder="Ej. 100m norte del parque central" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none">
              </div>
            </div>

            <!-- Teléfono y Correo -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1 text-xs">Teléfono / WhatsApp (+506) *</label>
                <input type="tel" id="edit-biz-phone" value="${this.escapeHtml(biz.phone || '')}" required placeholder="+506 8888 7777" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none">
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1 text-xs">Correo Electrónico</label>
                <input type="email" id="edit-biz-email" value="${this.escapeHtml(biz.email || '')}" placeholder="contacto@negocio.cr" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none">
              </div>
            </div>

            <!-- Descripción -->
            <div>
              <label class="block font-bold text-slate-700 mb-1 text-xs">Descripción del Comercio</label>
              <textarea id="edit-biz-desc" rows="2" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none">${this.escapeHtml(biz.description || '')}</textarea>
            </div>

            <!-- URLs de Imágenes -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1 text-xs">URL Imagen de Perfil / Logo</label>
                <input type="url" id="edit-biz-image" value="${this.escapeHtml(biz.image || '')}" placeholder="https://..." class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none">
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1 text-xs">URL Foto de Portada</label>
                <input type="url" id="edit-biz-cover" value="${this.escapeHtml(biz.coverImage || '')}" placeholder="https://..." class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none">
              </div>
            </div>

            <!-- Plan y Control de Bloqueo -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200">
              <div>
                <label class="block font-bold text-slate-700 mb-1 text-xs">Plan de Suscripción</label>
                <select id="edit-biz-plan" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs">
                  <option value="test" ${biz.plan === 'test' ? 'selected' : ''}>Prueba ($0.10 - 24h)</option>
                  <option value="basic" ${biz.plan === 'basic' ? 'selected' : ''}>Básico ($8/mes - 50 res.)</option>
                  <option value="pro" ${biz.plan === 'pro' ? 'selected' : ''}>Profesional ($15/mes - 200 res.)</option>
                  <option value="unlimited" ${biz.plan === 'unlimited' ? 'selected' : ''}>Ilimitado ($25/mes - ∞)</option>
                </select>
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1 text-xs">Estado de Operación</label>
                <select id="edit-biz-status" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs">
                  <option value="active" ${!biz.isBlocked ? 'selected' : ''}>🟢 Activo & Operando</option>
                  <option value="blocked" ${biz.isBlocked ? 'selected' : ''}>🔴 Bloqueado / Suspendido</option>
                </select>
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1 text-xs">Visibilidad</label>
                <select id="edit-biz-visibility" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs">
                  <option value="visible" ${!biz.isHidden ? 'selected' : ''}>👁️ Visible en Directorio</option>
                  <option value="hidden" ${biz.isHidden ? 'selected' : ''}>🙈 Oculto en Inicio</option>
                </select>
              </div>
            </div>

            <!-- Motivo de Bloqueo (si aplica) -->
            <div id="edit-biz-reason-container" class="${biz.isBlocked ? '' : 'hidden'}">
              <label class="block font-bold text-rose-700 mb-1 text-xs">Motivo de Bloqueo / Suspensión</label>
              <input type="text" id="edit-biz-reason" value="${this.escapeHtml(biz.blockReason || '')}" placeholder="Ej. Suspensión administrativa temporal..." class="w-full px-3.5 py-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs">
            </div>

            <!-- Botones de Acción -->
            <div class="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
              <button type="button" id="cancel-edit-biz-btn" class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer">
                Cancelar
              </button>
              <button type="submit" id="save-edit-biz-btn" class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5 cursor-pointer">
                <i class="fas fa-save"></i>
                <span>Guardar Cambios</span>
              </button>
            </div>
          </form>

        </div>
      </div>
    `;

    document.getElementById('close-edit-biz-modal-btn')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
    });
    document.getElementById('cancel-edit-biz-btn')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
    });

    const statusSelect = document.getElementById('edit-biz-status');
    const reasonContainer = document.getElementById('edit-biz-reason-container');
    statusSelect?.addEventListener('change', () => {
      if (statusSelect.value === 'blocked') {
        reasonContainer?.classList.remove('hidden');
      } else {
        reasonContainer?.classList.add('hidden');
      }
    });

    document.getElementById('edit-business-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('save-edit-biz-btn');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Guardando...';
      }

      const selectedCatId = document.getElementById('edit-biz-category')?.value;
      const selectedCatObj = categories.find(c => c.id === selectedCatId);
      const isBlockedVal = document.getElementById('edit-biz-status')?.value === 'blocked';
      const isHiddenVal = document.getElementById('edit-biz-visibility')?.value === 'hidden';
      const selectedPlan = document.getElementById('edit-biz-plan')?.value;

      const updated = {
        ...biz,
        name: document.getElementById('edit-biz-name')?.value.trim(),
        category: selectedCatId,
        categoryLabel: selectedCatObj ? selectedCatObj.name : selectedCatId,
        city: document.getElementById('edit-biz-city')?.value.trim(),
        address: document.getElementById('edit-biz-address')?.value.trim(),
        phone: document.getElementById('edit-biz-phone')?.value.trim(),
        email: document.getElementById('edit-biz-email')?.value.trim(),
        description: document.getElementById('edit-biz-desc')?.value.trim(),
        image: document.getElementById('edit-biz-image')?.value.trim() || biz.image,
        coverImage: document.getElementById('edit-biz-cover')?.value.trim() || biz.coverImage,
        plan: selectedPlan,
        isBlocked: isBlockedVal,
        blockReason: isBlockedVal ? (document.getElementById('edit-biz-reason')?.value.trim() || 'Suspensión administrativa') : '',
        isHidden: isHiddenVal
      };

      try {
        await storage.saveBusiness(updated);
        this.showToast(`¡Negocio "${updated.name}" actualizado con éxito!`, 'success');
        modalContainer.innerHTML = '';
        this.renderCurrentView();
      } catch (err) {
        this.showToast(err.message || 'Error al guardar cambios del negocio.', 'error');
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<i class="fas fa-save mr-1"></i> Guardar Cambios';
        }
      }
    });
  }

  // --- MODAL PARA EDITAR PRE-REGISTRO ---
  async renderEditPreRegistrationModal(prId) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const preRegs = await storage.getPreRegistrations();
    const pr = preRegs.find(p => p.id === prId);
    if (!pr) {
      this.showToast('Pre-registro no encontrado.', 'error');
      return;
    }

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop animate-fade-in overflow-y-auto">
        <div class="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 p-6 sm:p-8 my-8 max-h-[90vh] flex flex-col">
          
          <div class="flex items-center justify-between pb-4 border-b border-slate-100">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-lg font-black shadow-xs">
                <i class="fas fa-rocket"></i>
              </div>
              <div>
                <span class="text-xs font-bold text-amber-600 uppercase tracking-wider">SuperAdmin Dev</span>
                <h3 class="text-lg font-black text-slate-900">Modificar Pre-Registro</h3>
              </div>
            </div>
            <button id="close-edit-prereg-modal-btn" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer">
              <i class="fas fa-times text-xs"></i>
            </button>
          </div>

          <form id="edit-prereg-form" class="p-2 pt-4 space-y-4 overflow-y-auto text-xs sm:text-sm flex-1">
            <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <span class="text-slate-500 font-medium">ID: <strong class="font-mono text-slate-800">${pr.id}</strong></span>
              <span class="text-slate-400 font-medium">${new Date(pr.createdAt).toLocaleString('es-CR')}</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1 text-xs">Nombre del Comercio / Negocio *</label>
                <input type="text" id="edit-prereg-biz-name" value="${this.escapeHtml(pr.businessName || '')}" required class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1 text-xs">Persona de Contacto *</label>
                <input type="text" id="edit-prereg-contact-name" value="${this.escapeHtml(pr.contactName || '')}" required class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none">
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1 text-xs">Teléfono / WhatsApp (+506) *</label>
                <input type="tel" id="edit-prereg-phone" value="${this.escapeHtml(pr.phone || '')}" required class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1 text-xs">Provincia / Cantón</label>
                <input type="text" id="edit-prereg-city" value="${this.escapeHtml(pr.city || '')}" placeholder="Ej. San José, Escazú" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none">
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1 text-xs">Categoría</label>
                <input type="text" id="edit-prereg-cat" value="${this.escapeHtml(pr.category || '')}" placeholder="Ej. Belleza y Barbería" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1 text-xs">Plan de Interés</label>
                <select id="edit-prereg-plan" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none">
                  <option value="basic" ${pr.planInterest === 'basic' ? 'selected' : ''}>Plan Básico ($10)</option>
                  <option value="pro" ${pr.planInterest === 'pro' || !pr.planInterest ? 'selected' : ''}>Plan Pro ($18)</option>
                  <option value="unlimited" ${pr.planInterest === 'unlimited' ? 'selected' : ''}>Plan Ilimitado ($35)</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1 text-xs">Estado / Bloqueo</label>
                <select id="edit-prereg-status" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none">
                  <option value="pending" ${!pr.isBlocked ? 'selected' : ''}>🟡 Pendiente de Contacto</option>
                  <option value="contacted" ${pr.status === 'contacted' ? 'selected' : ''}>💬 Contactado</option>
                  <option value="active" ${pr.status === 'active' ? 'selected' : ''}>🟢 Activado en la Plataforma</option>
                  <option value="blocked" ${pr.isBlocked ? 'selected' : ''}>🔴 Bloqueado / Descartado</option>
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1 text-xs">Motivo de Bloqueo (opcional)</label>
                <input type="text" id="edit-prereg-reason" value="${this.escapeHtml(pr.blockReason || '')}" placeholder="Ej. Número no responde / Descartado" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1 text-xs">Notas / Observaciones</label>
              <textarea id="edit-prereg-notes" rows="2" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">${this.escapeHtml(pr.notes || '')}</textarea>
            </div>

            <div class="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
              <button type="button" id="cancel-edit-prereg-btn" class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer">
                Cancelar
              </button>
              <button type="submit" id="save-edit-prereg-btn" class="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black shadow-md shadow-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer">
                <i class="fas fa-save"></i>
                <span>Guardar Cambios</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.getElementById('close-edit-prereg-modal-btn')?.addEventListener('click', () => { modalContainer.innerHTML = ''; });
    document.getElementById('cancel-edit-prereg-btn')?.addEventListener('click', () => { modalContainer.innerHTML = ''; });

    document.getElementById('edit-prereg-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('save-edit-prereg-btn');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Guardando...';
      }

      const statusVal = document.getElementById('edit-prereg-status')?.value;
      const isBlockedVal = statusVal === 'blocked';

      const updated = {
        id: pr.id,
        businessName: document.getElementById('edit-prereg-biz-name')?.value.trim(),
        contactName: document.getElementById('edit-prereg-contact-name')?.value.trim(),
        phone: document.getElementById('edit-prereg-phone')?.value.trim(),
        city: document.getElementById('edit-prereg-city')?.value.trim(),
        category: document.getElementById('edit-prereg-cat')?.value.trim(),
        planInterest: document.getElementById('edit-prereg-plan')?.value,
        status: statusVal,
        isBlocked: isBlockedVal,
        blockReason: isBlockedVal ? (document.getElementById('edit-prereg-reason')?.value.trim() || 'Descartado por administración') : '',
        notes: document.getElementById('edit-prereg-notes')?.value.trim()
      };

      try {
        await storage.savePreRegistrationByDeveloper(updated);
        this.showToast(`Pre-registro de "${updated.businessName}" actualizado.`, 'success');
        modalContainer.innerHTML = '';
        this.renderCurrentView();
      } catch (err) {
        this.showToast(err.message || 'Error al guardar.', 'error');
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<i class="fas fa-save mr-1"></i> Guardar Cambios';
        }
      }
    });
  }

  // --- MODAL PARA EDITAR CLIENTE / USUARIO ---
  async renderEditClientModal(clientId) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const clients = await storage.getDeveloperClients();
    const c = clients.find(cl => cl.id === clientId);
    if (!c) {
      this.showToast('Cliente no encontrado.', 'error');
      return;
    }

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop animate-fade-in overflow-y-auto">
        <div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 p-6 sm:p-8 my-8 max-h-[90vh] flex flex-col">
          
          <div class="flex items-center justify-between pb-4 border-b border-slate-100">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center text-lg font-black shadow-xs">
                <i class="fas fa-user-edit"></i>
              </div>
              <div>
                <span class="text-xs font-bold text-blue-600 uppercase tracking-wider">SuperAdmin Dev</span>
                <h3 class="text-lg font-black text-slate-900">Modificar Usuario Cliente</h3>
              </div>
            </div>
            <button id="close-edit-client-modal-btn" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer">
              <i class="fas fa-times text-xs"></i>
            </button>
          </div>

          <form id="edit-client-form" class="p-2 pt-4 space-y-4 overflow-y-auto text-xs sm:text-sm flex-1">
            <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <span class="text-slate-500 font-medium">ID Cliente: <strong class="font-mono text-slate-800">${c.id}</strong></span>
              <span class="text-blue-600 font-bold">${c.appointmentsCount || 0} Reservas Totales</span>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1 text-xs">Nombre Completo *</label>
              <input type="text" id="edit-client-name" value="${this.escapeHtml(c.name || '')}" required class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none">
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1 text-xs">Teléfono / WhatsApp (+506) *</label>
                <input type="tel" id="edit-client-phone" value="${this.escapeHtml(c.phone || '')}" required class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1 text-xs">Correo Electrónico</label>
                <input type="email" id="edit-client-email" value="${this.escapeHtml(c.email || '')}" placeholder="cliente@correo.com" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none">
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1 text-xs">Estado de Acceso</label>
                <select id="edit-client-status" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  <option value="active" ${!c.isBlocked ? 'selected' : ''}>🟢 Activo (Puede Reservar)</option>
                  <option value="blocked" ${c.isBlocked ? 'selected' : ''}>🔴 Bloqueado / Suspendido</option>
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1 text-xs">Motivo de Bloqueo (si aplica)</label>
                <input type="text" id="edit-client-reason" value="${this.escapeHtml(c.blockReason || '')}" placeholder="Ej. Inasistencias reiteradas / Spam" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              </div>
            </div>

            <div class="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
              <button type="button" id="cancel-edit-client-btn" class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer">
                Cancelar
              </button>
              <button type="submit" id="save-edit-client-btn" class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5 cursor-pointer">
                <i class="fas fa-save"></i>
                <span>Guardar Cambios</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.getElementById('close-edit-client-modal-btn')?.addEventListener('click', () => { modalContainer.innerHTML = ''; });
    document.getElementById('cancel-edit-client-btn')?.addEventListener('click', () => { modalContainer.innerHTML = ''; });

    document.getElementById('edit-client-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('save-edit-client-btn');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Guardando...';
      }

      const isBlockedVal = document.getElementById('edit-client-status')?.value === 'blocked';

      const updated = {
        id: c.id,
        name: document.getElementById('edit-client-name')?.value.trim(),
        phone: document.getElementById('edit-client-phone')?.value.trim(),
        email: document.getElementById('edit-client-email')?.value.trim(),
        isBlocked: isBlockedVal,
        blockReason: isBlockedVal ? (document.getElementById('edit-client-reason')?.value.trim() || 'Bloqueado por administración') : ''
      };

      try {
        await storage.saveClientByDeveloper(updated);
        this.showToast(`Usuario "${updated.name}" actualizado con éxito.`, 'success');
        modalContainer.innerHTML = '';
        this.renderCurrentView();
      } catch (err) {
        this.showToast(err.message || 'Error al guardar usuario.', 'error');
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<i class="fas fa-save mr-1"></i> Guardar Cambios';
        }
      }
    });
  }

  // --- MODAL DE RECUPERACIÓN DE CONTRASEÑA (VÍA CORREO RESEND) ---
  renderForgotPasswordModal({ role = 'client', step = 'request', email = '' } = {}) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const accentColor = role === 'business' ? 'indigo' : 'blue';

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop animate-fade-in overflow-y-auto">
        <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200/90 my-8">
          
          <!-- Encabezado del Modal -->
          <div class="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-base font-bold shadow-md shadow-blue-500/20">
                <i class="fas ${step === 'request' ? 'fa-key' : 'fa-shield-alt'}"></i>
              </div>
              <div>
                <h3 class="text-base font-bold text-white">
                  ${step === 'request' ? 'Recuperar Contraseña' : 'Crear Nueva Contraseña'}
                </h3>
                <span class="text-[11px] text-slate-400 font-medium block">
                  ${role === 'business' ? 'Cuenta de Comercio / Dueño' : 'Cuenta de Cliente'}
                </span>
              </div>
            </div>
            <button id="close-forgot-modal-btn" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer">
              <i class="fas fa-times text-xs"></i>
            </button>
          </div>

          <!-- Cuerpo del Modal -->
          <div class="p-6 space-y-4">
            ${step === 'request' ? `
              <!-- PASO 1: SOLICITAR CÓDIGO POR CORREO -->
              <p class="text-xs text-slate-600 leading-relaxed">
                Ingresa el correo electrónico asociado a tu cuenta. Te enviaremos un <strong>código de seguridad de 6 dígitos</strong> para que puedas restablecer tu contraseña.
              </p>

              <div id="forgot-req-error" class="hidden p-3 bg-rose-50 border border-rose-300 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in"></div>

              <form id="forgot-request-form" class="space-y-4 text-xs sm:text-sm">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Correo Electrónico Registrado *</label>
                  <input type="email" id="forgot-req-email" value="${this.escapeHtml(email)}" required placeholder="tu-correo@ejemplo.com" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none">
                </div>

                <button type="submit" id="forgot-req-submit-btn" class="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer">
                  <i class="fas fa-paper-plane"></i>
                  <span>Enviar Código de Recuperación</span>
                </button>
              </form>

              <div class="pt-3 border-t border-slate-100 text-center">
                <button type="button" id="back-to-login-btn" class="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer flex items-center justify-center gap-1.5 mx-auto">
                  <i class="fas fa-arrow-left text-[10px]"></i>
                  <span>Volver a Iniciar Sesión</span>
                </button>
              </div>
            ` : `
              <!-- PASO 2: INGRESAR CÓDIGO Y NUEVA CONTRASEÑA -->
              <div class="p-3 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-start gap-2.5">
                <i class="fas fa-envelope-open-text text-blue-600 text-sm mt-0.5 flex-shrink-0"></i>
                <div class="text-xs text-blue-900 leading-snug">
                  Código enviado a <strong>${this.escapeHtml(email)}</strong>. Revisa tu bandeja de entrada o spam.
                </div>
              </div>

              <div id="forgot-reset-error" class="hidden p-3 bg-rose-50 border border-rose-300 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in"></div>

              <form id="forgot-reset-form" class="space-y-4 text-xs sm:text-sm">
                <!-- Código de 6 dígitos -->
                <div>
                  <label class="block font-bold text-slate-700 mb-1 text-center">Código de Verificación (6 dígitos) *</label>
                  <input type="text" id="forgot-reset-code" required maxlength="6" placeholder="• • • • • •" class="w-full px-4 py-3 bg-slate-50 border-2 border-slate-300 rounded-xl font-mono text-center text-xl font-black tracking-widest text-slate-900 focus:border-blue-600 focus:outline-none focus:bg-white transition-all">
                </div>

                <!-- Nueva Contraseña -->
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Nueva Contraseña (mínimo 6 caracteres) *</label>
                  <input type="password" id="forgot-new-pass" required minlength="6" placeholder="••••••••" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none">
                </div>

                <!-- Confirmar Nueva Contraseña -->
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Confirmar Nueva Contraseña *</label>
                  <input type="password" id="forgot-new-pass-conf" required minlength="6" placeholder="Repite tu nueva contraseña" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none">
                </div>

                <!-- Validación inline -->
                <div id="forgot-inline-pass-error" class="hidden p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all"></div>

                <button type="submit" id="forgot-reset-submit-btn" class="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer">
                  <i class="fas fa-check-circle"></i>
                  <span>Guardar y Restablecer Contraseña</span>
                </button>
              </form>

              <div class="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <button type="button" id="resend-code-btn" class="font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer flex items-center gap-1">
                  <i class="fas fa-redo text-[10px]"></i> Reenviar código
                </button>
                <button type="button" id="back-to-step1-btn" class="font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer flex items-center gap-1">
                  <i class="fas fa-edit text-[10px]"></i> Cambiar correo
                </button>
              </div>
            `}
          </div>
        </div>
      </div>
    `;

    // Cerrar modal
    document.getElementById('close-forgot-modal-btn')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
    });

    // Volver a login
    document.getElementById('back-to-login-btn')?.addEventListener('click', () => {
      this.renderAuthModal({ mode: 'login', role });
    });

    if (step === 'request') {
      // Manejar envío de solicitud de código
      const reqForm = document.getElementById('forgot-request-form');
      reqForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('forgot-req-email');
        const submitBtn = document.getElementById('forgot-req-submit-btn');
        const errBox = document.getElementById('forgot-req-error');
        const cleanEmail = emailInput?.value.trim().toLowerCase();

        if (!cleanEmail) return;

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Enviando código...</span>';
        }
        if (errBox) errBox.className = 'hidden';

        try {
          const res = await storage.requestPasswordReset(cleanEmail, role);
          this.showToast(res.message || 'Código enviado exitosamente a tu correo.', 'success');
          this.renderForgotPasswordModal({ role, step: 'reset', email: cleanEmail });
        } catch (err) {
          if (errBox) {
            errBox.className = 'p-3 bg-rose-50 border border-rose-300 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in';
            errBox.innerHTML = `<i class="fas fa-exclamation-circle text-rose-600 text-sm flex-shrink-0"></i> <span>${err.message || 'Error al solicitar código.'}</span>`;
          } else {
            this.showToast(err.message || 'Error al solicitar código.', 'error');
          }
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> <span>Enviar Código de Recuperación</span>';
          }
        }
      });
    } else {
      // Validación en vivo de contraseñas en paso 2
      const pass1 = document.getElementById('forgot-new-pass');
      const pass2 = document.getElementById('forgot-new-pass-conf');
      const inlineBox = document.getElementById('forgot-inline-pass-error');

      const checkMatch = () => {
        if (!pass1 || !pass2 || !inlineBox) return true;
        const v1 = pass1.value;
        const v2 = pass2.value;

        if (!v1 && !v2) {
          inlineBox.className = 'hidden';
          return true;
        }

        if (v2.length > 0 && v1 !== v2) {
          inlineBox.className = 'p-2.5 bg-rose-50 border border-rose-300 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in';
          inlineBox.innerHTML = '<i class="fas fa-exclamation-circle text-rose-600 text-sm flex-shrink-0"></i> <span>Las contraseñas no coinciden.</span>';
          return false;
        } else if (v1.length >= 6 && v1 === v2) {
          inlineBox.className = 'p-2 bg-emerald-50 border border-emerald-300 text-emerald-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in';
          inlineBox.innerHTML = '<i class="fas fa-check-circle text-emerald-600 text-sm flex-shrink-0"></i> <span>¡Las contraseñas coinciden!</span>';
          return true;
        } else if (v1.length > 0 && v1.length < 6) {
          inlineBox.className = 'p-2 bg-amber-50 border border-amber-300 text-amber-800 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in';
          inlineBox.innerHTML = '<i class="fas fa-info-circle text-amber-600 text-sm flex-shrink-0"></i> <span>Mínimo 6 caracteres.</span>';
          return false;
        } else {
          inlineBox.className = 'hidden';
          return true;
        }
      };

      pass1?.addEventListener('input', checkMatch);
      pass2?.addEventListener('input', checkMatch);

      // Reenviar código
      document.getElementById('resend-code-btn')?.addEventListener('click', async () => {
        try {
          this.showToast('Reenviando nuevo código a tu correo...', 'info');
          await storage.requestPasswordReset(email, role);
          this.showToast('¡Nuevo código enviado! Revisa tu bandeja de entrada.', 'success');
        } catch (err) {
          this.showToast(err.message || 'Error al reenviar código.', 'error');
        }
      });

      // Cambiar correo (volver a paso 1)
      document.getElementById('back-to-step1-btn')?.addEventListener('click', () => {
        this.renderForgotPasswordModal({ role, step: 'request', email });
      });

      // Manejar envío de restablecimiento de contraseña
      const resetForm = document.getElementById('forgot-reset-form');
      resetForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const codeInput = document.getElementById('forgot-reset-code');
        const passInput = document.getElementById('forgot-new-pass');
        const passConfInput = document.getElementById('forgot-new-pass-conf');
        const submitBtn = document.getElementById('forgot-reset-submit-btn');
        const errBox = document.getElementById('forgot-reset-error');

        const codeVal = codeInput?.value.trim();
        const passVal = passInput?.value;
        const passConfVal = passConfInput?.value;

        if (!codeVal || codeVal.length < 4) {
          this.showToast('Ingresa el código de 6 dígitos que te enviamos.', 'warning');
          codeInput?.focus();
          return;
        }

        if (passVal !== passConfVal) {
          this.showToast('Las contraseñas no coinciden.', 'error');
          passConfInput?.focus();
          return;
        }

        if (passVal.length < 6) {
          this.showToast('La nueva contraseña debe tener al menos 6 caracteres.', 'warning');
          passInput?.focus();
          return;
        }

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Actualizando contraseña...</span>';
        }
        if (errBox) errBox.className = 'hidden';

        try {
          const res = await storage.resetPasswordWithCode(email, codeVal, passVal);
          this.showToast('¡Contraseña actualizada con éxito! Ya puedes iniciar sesión.', 'success');
          
          // Abrir automáticamente el modal de login con el correo prellenado
          this.renderAuthModal({ mode: 'login', role });
          setTimeout(() => {
            const loginEmailInput = role === 'business' ? document.getElementById('biz-log-email') : document.getElementById('cli-log-identifier');
            const passTarget = role === 'business' ? document.getElementById('biz-log-password') : document.getElementById('cli-log-password');
            if (loginEmailInput) loginEmailInput.value = email;
            if (passTarget) passTarget.focus();
          }, 100);
        } catch (err) {
          if (errBox) {
            errBox.className = 'p-3 bg-rose-50 border border-rose-300 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in';
            errBox.innerHTML = `<i class="fas fa-exclamation-circle text-rose-600 text-sm flex-shrink-0"></i> <span>${err.message || 'Error al restablecer contraseña.'}</span>`;
          } else {
            this.showToast(err.message || 'Error al restablecer contraseña.', 'error');
          }
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> <span>Guardar y Restablecer Contraseña</span>';
          }
        }
      });
    }
  }

  // Métodos de conveniencia
  renderBusinessAuthModal() {
    this.renderAuthModal({ mode: 'login', role: 'business' });
  }

  renderClientAuthModal() {
    this.renderAuthModal({ mode: 'login', role: 'client' });
  }

  renderNewBusinessModal() {
    this.renderAuthModal({ mode: 'register', role: 'business' });
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

  // --- MODAL PARA REGISTRAR NUEVO NEGOCIO (CON CONTRASEÑA) ---
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
            <!-- Cuenta de Usuario / Credenciales -->
            <div class="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl space-y-3">
              <span class="font-bold text-indigo-900 block text-xs uppercase tracking-wider">
                <i class="fas fa-lock mr-1"></i> Credenciales de Acceso para el Dueño
              </span>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Nombre del Administrador *</label>
                  <input type="text" id="reg-owner-name" required placeholder="Ej. Carlos Rodríguez" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium">
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Correo para Iniciar Sesión *</label>
                  <input type="email" id="reg-biz-email" required placeholder="admin@comercio.cr" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium">
                </div>
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1">Crea una Contraseña de Acceso *</label>
                <input type="password" id="reg-biz-password" required placeholder="Mínimo 6 caracteres" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium">
              </div>
            </div>

            <!-- Datos Comerciales -->
            <div>
              <label class="block font-bold text-slate-700 mb-1">Nombre Comercial del Negocio *</label>
              <input type="text" id="new-biz-name" required placeholder="Ej. Barbería Costa Rica, Clínica Dental..." class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none">
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
                <label class="block font-bold text-slate-700 mb-1">Dirección Exacta</label>
                <input type="text" id="new-biz-address" placeholder="100m Oeste del Parque..." class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none">
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Descripción</label>
              <textarea id="new-biz-desc" rows="2" placeholder="Describe brevemente tus especialidades..." class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"></textarea>
            </div>

            <!-- Fotos con Guía de Medidas -->
            <div class="p-4 bg-blue-50/70 border border-blue-100 rounded-2xl space-y-3">
              <span class="font-bold text-blue-900 block text-xs uppercase tracking-wider">
                <i class="fas fa-camera mr-1"></i> Fotos del Comercio (Guía de Medidas)
              </span>

              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-xs font-bold text-slate-700">Logo / Foto de Perfil</label>
                  <span class="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">Medida: 800 x 800 px (1:1)</span>
                </div>
                <input type="text" id="new-biz-image" placeholder="URL de imagen cuadrada" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs">
              </div>

              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-xs font-bold text-slate-700">Banner / Foto de Portada</label>
                  <span class="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">Medida: 1200 x 450 px (16:6)</span>
                </div>
                <input type="text" id="new-biz-cover" placeholder="URL del banner panorámico" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs">
              </div>
            </div>

            <!-- Primer Servicio -->
            <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <span class="font-bold text-slate-800 block text-xs uppercase tracking-wider">
                <i class="fas fa-tag mr-1 text-emerald-600"></i> Primer Servicio
              </span>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div class="sm:col-span-2">
                  <input type="text" id="first-srv-name" required placeholder="Nombre del servicio (Ej. Corte Clásico)" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs">
                </div>
                <div>
                  <input type="number" id="first-srv-price" required min="0" step="500" placeholder="Precio ₡ CRC" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold">
                </div>
              </div>
            </div>

            <button type="submit" class="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold shadow-lg shadow-emerald-500/25 transition-all text-sm flex items-center justify-center gap-2">
              <i class="fas fa-check-circle"></i>
              <span>Crear Cuenta y Registrar Negocio</span>
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
      const ownerName = document.getElementById('reg-owner-name').value;
      const email = document.getElementById('reg-biz-email').value;
      const password = document.getElementById('reg-biz-password').value;
      const name = document.getElementById('new-biz-name').value;
      const category = document.getElementById('new-biz-cat').value;
      const city = document.getElementById('new-biz-city').value;
      const phone = document.getElementById('new-biz-phone').value;
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

      try {
        await storage.registerBusinessWithUser(ownerName, email, password, {
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
            { name: firstSrvName, duration: 30, price: parseFloat(firstSrvPrice) || 10000, description: 'Servicio principal.' }
          ]
        });

        this.showToast('¡Negocio y cuenta creados exitosamente!', 'success');
        modalContainer.innerHTML = '';
        this.renderHeader();
        this.navigateTo('owner-dashboard');
      } catch (err) {
        this.showToast(err.message || 'Error al registrar.', 'error');
      }
    });
  }

  // --- EVENTOS GLOBALES ---
  setupGlobalEvents() {
    window.addEventListener('keydown', (e) => {
      // Escape para cerrar cualquier modal
      if (e.key === 'Escape') {
        this.closeBookingModal();
        const modalContainer = document.getElementById('modal-container');
        if (modalContainer) modalContainer.innerHTML = '';
      }
    });
  }
}

function startApp() {
  const app = new App();
  app.init();
  window.__reservasCRApp = app;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
