// Servicio de almacenamiento conectado a Neon PostgreSQL con autenticación de Negocios y Clientes
import { INITIAL_BUSINESSES, INITIAL_APPOINTMENTS, INITIAL_CATEGORIES, SUBSCRIPTION_PLANS, COSTA_RICA_PROVINCES } from '../data/initialData.js';

const STORAGE_KEYS = {
  BUSINESSES: 'directorio_businesses_v1',
  APPOINTMENTS: 'directorio_appointments_v1',
  ACTIVE_BUSINESS_ID: 'directorio_active_biz_id',
  BIZ_USER: 'directorio_biz_user_session',
  CLIENT_USER: 'directorio_client_user_session',
  DEV_USER: 'directorio_dev_user_session',
  BLOCKED_SLOTS: 'directorio_blocked_slots_v1'
};

class StorageService {
  constructor() {
    this.apiBase = '/api';
    this.businessesCache = [];
    this.appointmentsCache = [];
    this.blockedSlotsCache = [];
    this.isOnlineApi = true;
    this.init();
  }

  async initAsync() {
    return this.init();
  }

  async init() {
    try {
      await this.loadFromApi();
    } catch (e) {
      console.warn('Operando en modo local (sin servidor Express activo):', e);
      this.isOnlineApi = false;
      if (!localStorage.getItem(STORAGE_KEYS.BUSINESSES)) {
        localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(INITIAL_BUSINESSES));
      }
      if (!localStorage.getItem(STORAGE_KEYS.APPOINTMENTS)) {
        localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(INITIAL_APPOINTMENTS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.BLOCKED_SLOTS)) {
        localStorage.setItem(STORAGE_KEYS.BLOCKED_SLOTS, JSON.stringify([]));
      }
    }
  }

  async loadFromApi() {
    try {
      const res = await fetch(`${this.apiBase}/businesses`);
      if (!res.ok) throw new Error('API no disponible');
      this.businessesCache = await res.json();
      this.isOnlineApi = true;
    } catch (e) {
      this.isOnlineApi = false;
      const local = localStorage.getItem(STORAGE_KEYS.BUSINESSES);
      this.businessesCache = local ? JSON.parse(local) : INITIAL_BUSINESSES;
    }

    try {
      const resSlots = await fetch(`${this.apiBase}/blocked-slots`);
      if (resSlots.ok) {
        this.blockedSlotsCache = await resSlots.json();
        localStorage.setItem(STORAGE_KEYS.BLOCKED_SLOTS, JSON.stringify(this.blockedSlotsCache));
      }
    } catch (e) {
      const localSlots = localStorage.getItem(STORAGE_KEYS.BLOCKED_SLOTS);
      this.blockedSlotsCache = localSlots ? JSON.parse(localSlots) : [];
    }
  }

  // ==========================================
  // AUTENTICACIÓN: DEVELOPER / SUPERADMIN
  // ==========================================
  getDeveloperUser() {
    const data = localStorage.getItem(STORAGE_KEYS.DEV_USER);
    return data ? JSON.parse(data) : null;
  }

  setDeveloperUser(user) {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.DEV_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.DEV_USER);
    }
  }

  logoutDeveloper() {
    localStorage.removeItem(STORAGE_KEYS.DEV_USER);
  }

  async loginDeveloper(email, password) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    if ((cleanEmail === 'admin@reservas.cr' || cleanEmail === 'admin' || cleanEmail === 'dev@reservas.cr' || cleanEmail === 'developer') && (cleanPass === 'admin123' || cleanPass === 'admin')) {
      const devUser = { id: 'dev-master', name: 'Master Developer', email: 'admin@reservas.cr', role: 'developer' };
      this.setDeveloperUser(devUser);
      return { success: true, role: 'developer', user: devUser };
    }

    if (this.isOnlineApi) {
      const res = await fetch(`${this.apiBase}/auth/developer/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPass })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al autenticar desarrollador.');
      this.setDeveloperUser(data.user);
      return data;
    }

    throw new Error('Credenciales de Developer incorrectas.');
  }

  // Métodos de consulta SuperAdmin / Developer con fallback offline/online
  async getDeveloperStats() {
    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/developer/stats`);
        if (res.ok) return await res.json();
      } catch (e) {
        console.warn('Fallback local para stats developer');
      }
    }
    const bizList = this.getBusinesses();
    const aptList = this.getAppointments();
    return {
      totalBusinesses: bizList.length,
      totalClients: 4,
      totalAppointments: aptList.length,
      unreadAlerts: 0
    };
  }

  async getDeveloperBusinesses() {
    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/developer/businesses`);
        if (res.ok) return await res.json();
      } catch (e) {
        console.warn('Fallback local para negocios developer');
      }
    }
    return this.getBusinesses();
  }

  async getDeveloperClients() {
    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/developer/clients`);
        if (res.ok) return await res.json();
      } catch (e) {
        console.warn('Fallback local para clientes developer');
      }
    }
    const client = this.getClientUser();
    return client ? [client] : [
      { id: 'cli-1', name: 'Carlos Mendoza', phone: '+506 8899 1122', email: 'carlos.m@example.com', appointmentsCount: 1 },
      { id: 'cli-2', name: 'Alejandro Rivera', phone: '+506 8765 1234', email: 'alejandro.r@example.com', appointmentsCount: 1 },
      { id: 'cli-3', name: 'Mariana Gómez', phone: '+506 7011 2233', email: 'mariana.g@example.com', appointmentsCount: 1 }
    ];
  }

  async getDeveloperAppointments() {
    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/developer/appointments`);
        if (res.ok) return await res.json();
      } catch (e) {
        console.warn('Fallback local para citas developer');
      }
    }
    return this.getAppointments();
  }

  async getDeveloperCategoryAlerts() {
    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/developer/category-alerts`);
        if (res.ok) return await res.json();
      } catch (e) {
        console.warn('Fallback local para alertas developer');
      }
    }
    const alerts = localStorage.getItem('reservas_dev_alerts');
    return alerts ? JSON.parse(alerts) : [];
  }

  async dismissCategoryAlert(alertId) {
    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/developer/category-alerts/${alertId}/dismiss`, { method: 'POST' });
        if (res.ok) return true;
      } catch (e) {}
    }
    return true;
  }

  async toggleBusinessVisibility(businessId, isHidden) {
    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/developer/businesses/${businessId}/visibility`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isHidden: Boolean(isHidden) })
        });
        if (res.ok) {
          await this.loadFromApi();
          return await res.json();
        }
      } catch (e) {
        console.error('Error actualizando visibilidad:', e);
      }
    }
    const businesses = this.getBusinesses();
    const idx = businesses.findIndex(b => b.id === businessId);
    if (idx >= 0) {
      businesses[idx].isHidden = Boolean(isHidden);
      localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(businesses));
    }
    return { success: true, isHidden };
  }

  async toggleBusinessBlock(businessId, isBlocked, reason = '') {
    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/developer/businesses/${businessId}/block`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isBlocked: Boolean(isBlocked), reason: String(reason || '') })
        });
        if (res.ok) {
          await this.loadFromApi();
          return await res.json();
        }
      } catch (e) {
        console.error('Error actualizando bloqueo:', e);
      }
    }
    const businesses = this.getBusinesses();
    const idx = businesses.findIndex(b => b.id === businessId);
    if (idx >= 0) {
      businesses[idx].isBlocked = Boolean(isBlocked);
      businesses[idx].blockReason = reason;
      localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(businesses));
    }
    return { success: true, isBlocked, blockReason: reason };
  }

  async deleteBusinessByDeveloper(businessId) {
    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/developer/businesses/${businessId}`, { method: 'DELETE' });
        if (res.ok) {
          await this.loadFromApi();
          return true;
        }
        const errData = await res.json();
        throw new Error(errData.error || 'Error al eliminar negocio');
      } catch (e) {
        if (this.isOnlineApi) throw e;
      }
    }
    this.deleteBusiness(businessId);
    return true;
  }

  deleteBusiness(businessId) {
    let businesses = this.getBusinesses();
    businesses = businesses.filter(b => b.id !== businessId);
    this.businessesCache = businesses;
    localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(businesses));
    
    // Limpiar citas asociadas en local
    let appointments = this.getAppointments();
    appointments = appointments.filter(a => a.businessId !== businessId);
    this.appointmentsCache = appointments;
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));
  }

  async activateBusinessPlan(businessId, planId, daysValid = 30) {
    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/developer/activate-business-plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessId, planId, daysValid })
        });
        if (res.ok) {
          await this.loadFromApi();
          return await res.json();
        }
        const errData = await res.json();
        throw new Error(errData.error || 'Error al activar plan del comercio');
      } catch (e) {
        if (this.isOnlineApi) throw e;
      }
    }
    const businesses = this.getBusinesses();
    const idx = businesses.findIndex(b => b.id === businessId);
    if (idx >= 0) {
      const planConfigMap = {
        'free': { price: 0, limit: 25, name: 'Plan Gratis' },
        'basic': { price: 10.00, limit: 150, name: 'Plan Básico' },
        'pro': { price: 18.00, limit: 300, name: 'Plan Profesional' },
        'unlimited': { price: 35.00, limit: 999999, name: 'Plan Ilimitado' }
      };
      const p = planConfigMap[planId] || planConfigMap['pro'];
      businesses[idx].plan = planId;
      businesses[idx].planPriceUsd = p.price;
      businesses[idx].monthlyBookingLimit = p.limit;
      businesses[idx].subscriptionStatus = 'active';
      businesses[idx].paymentMethod = planId === 'free' ? 'free' : 'sinpe_movil';
      businesses[idx].subscriptionUpdatedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(businesses));
    }
    return { success: true };
  }

  // ==========================================
  // AUTENTICACIÓN: NEGOCIO (DUEÑO)
  // ==========================================
  getBusinessUser() {
    const data = localStorage.getItem(STORAGE_KEYS.BIZ_USER);
    return data ? JSON.parse(data) : null;
  }

  setBusinessUser(user) {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.BIZ_USER, JSON.stringify(user));
      if (user.businessId) {
        this.setActiveBusinessId(user.businessId);
      }
    } else {
      localStorage.removeItem(STORAGE_KEYS.BIZ_USER);
    }
  }

  logoutBusiness() {
    localStorage.removeItem(STORAGE_KEYS.BIZ_USER);
  }

  async loginBusiness(email, password) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    // Detección directa de Developer SuperAdmin (Instantánea)
    if ((cleanEmail === 'admin@reservas.cr' || cleanEmail === 'dev@reservas.cr' || cleanEmail === 'admin' || cleanEmail === 'developer') && (cleanPass === 'admin123' || cleanPass === 'admin')) {
      const devUser = { id: 'dev-master', name: 'Master Developer', email: 'admin@reservas.cr', role: 'developer' };
      this.setDeveloperUser(devUser);
      if (this.isOnlineApi) {
        fetch(`${this.apiBase}/auth/developer/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, password: cleanPass })
        }).catch(() => {});
      }
      return { success: true, role: 'developer', user: devUser };
    }

    if (this.isOnlineApi) {
      const res = await fetch(`${this.apiBase}/auth/business/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPass })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión.');

      // Si es Developer
      if (data.role === 'developer') {
        this.setDeveloperUser(data.user);
        return data;
      }

      // Si es Cliente logueándose aquí
      if (data.role === 'client') {
        this.setClientUser(data.client);
        return data;
      }

      this.setBusinessUser(data.user);
      await this.loadFromApi();
      return data;
    }

    // Fallback local
    const user = { id: 'usr-demo', name: 'Dueño Negocio Demo', email: cleanEmail, businessId: this.getActiveBusinessId() };
    this.setBusinessUser(user);
    return { success: true, role: 'business', user };
  }

  async registerBusinessWithUser(ownerName, email, password, businessData) {
    if (this.isOnlineApi) {
      const res = await fetch(`${this.apiBase}/auth/business/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerName, email, password, business: businessData })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar negocio.');
      this.setBusinessUser(data.user);
      await this.loadFromApi();
      return data;
    }

    // Fallback local
    const newId = `biz-${Date.now()}`;
    const user = { id: `usr-${Date.now()}`, name: ownerName, email, businessId: newId };
    this.saveBusiness({ ...businessData, id: newId });
    this.setBusinessUser(user);
    return { success: true, user };
  }

  // ==========================================
  // AUTENTICACIÓN: CLIENTE (USUARIO FINAL)
  // ==========================================
  getClientUser() {
    const data = localStorage.getItem(STORAGE_KEYS.CLIENT_USER);
    return data ? JSON.parse(data) : null;
  }

  setClientUser(client) {
    if (client) {
      localStorage.setItem(STORAGE_KEYS.CLIENT_USER, JSON.stringify(client));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CLIENT_USER);
    }
  }

  logoutClient() {
    localStorage.removeItem(STORAGE_KEYS.CLIENT_USER);
  }

  async registerClient(name, phone, email, password, whatsappOptIn = true) {
    if (this.isOnlineApi) {
      const res = await fetch(`${this.apiBase}/auth/client/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, password, whatsappOptIn })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar cliente.');
      this.setClientUser(data.client);
      return data.client;
    }

    const client = { id: `cli-${Date.now()}`, name, phone, email, whatsappOptIn };
    this.setClientUser(client);
    return client;
  }

  async loginClient(identifier, password) {
    const cleanIdent = (identifier || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    // Detección directa de Developer SuperAdmin (Instantánea)
    if ((cleanIdent === 'admin@reservas.cr' || cleanIdent === 'dev@reservas.cr' || cleanIdent === 'admin' || cleanIdent === 'developer') && (cleanPass === 'admin123' || cleanPass === 'admin')) {
      const devUser = { id: 'dev-master', name: 'Master Developer', email: 'admin@reservas.cr', role: 'developer' };
      this.setDeveloperUser(devUser);
      if (this.isOnlineApi) {
        fetch(`${this.apiBase}/auth/developer/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanIdent, password: cleanPass })
        }).catch(() => {});
      }
      return { success: true, role: 'developer', user: devUser };
    }

    if (this.isOnlineApi) {
      const res = await fetch(`${this.apiBase}/auth/client/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: cleanIdent, password: cleanPass })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión.');

      // Si es Developer
      if (data.role === 'developer') {
        this.setDeveloperUser(data.user);
        return data;
      }

      // Si es Negocio logueándose en pestaña de cliente
      if (data.role === 'business') {
        this.setBusinessUser(data.user);
        await this.loadFromApi();
        return data;
      }

      this.setClientUser(data.client);
      return data;
    }

    const client = { id: `cli-${Date.now()}`, name: identifier, phone: identifier, email: identifier };
    this.setClientUser(client);
    return { success: true, role: 'client', client };
  }

  async loginOrRegisterClient(name, phone, email, whatsappOptIn = true) {
    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/auth/client/login-or-register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, phone, email, whatsappOptIn })
        });
        const data = await res.json();
        if (res.ok && data.client) {
          this.setClientUser(data.client);
          return data.client;
        }
      } catch (err) {
        console.warn('Error en loginOrRegisterClient online, usando fallback local:', err);
      }
    }

    const client = { id: `cli-${Date.now()}`, name, phone, email, whatsappOptIn };
    this.setClientUser(client);
    return client;
  }

  // ==========================================
  // RECUPERACIÓN DE CONTRASEÑA (RESEND EMAIL)
  // ==========================================
  async requestPasswordReset(email, role = 'any') {
    if (this.isOnlineApi) {
      const res = await fetch(`${this.apiBase}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al solicitar código de recuperación.');
      return data;
    }

    return {
      success: true,
      email,
      message: 'Modo local: Código de prueba enviado.'
    };
  }

  async resetPasswordWithCode(email, code, newPassword) {
    if (this.isOnlineApi) {
      const res = await fetch(`${this.apiBase}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al restablecer la contraseña.');
      return data;
    }

    return {
      success: true,
      message: 'Contraseña actualizada en modo local.'
    };
  }

  // ==========================================
  // MANTENIMIENTO Y EXPORTACIÓN DEVELOPER
  // ==========================================
  async getCleanupStats() {
    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/developer/cleanup/stats`);
        if (res.ok) return await res.json();
      } catch (e) {
        console.error('Error obteniendo stats de limpieza:', e);
      }
    }
    return {
      passwordResets: 0,
      pastBlockedSlots: 0,
      oldCategoryAlerts: 0,
      cancelledAppointments: 0,
      oldPreregistrations: 0
    };
  }

  async executeDatabaseCleanup(options) {
    if (this.isOnlineApi) {
      const res = await fetch(`${this.apiBase}/developer/cleanup/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error ejecutando limpieza.');
      return data;
    }
    return { success: true, message: 'Limpieza simulada en modo local.', totalPurged: 0 };
  }

  getExportExcelUrl(params = {}) {
    const query = new URLSearchParams();
    if (params.businessId) query.append('businessId', params.businessId);
    if (params.status) query.append('status', params.status);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    return `${this.apiBase}/developer/export/appointments-excel?${query.toString()}`;
  }

  // --- CATEGORÍAS (INCLUYE CATEGORÍAS PERSONALIZADAS DINÁMICAS) ---
  getCategories() {
    const list = [...INITIAL_CATEGORIES];
    const businesses = this.getBusinesses();
    
    // Incorporar cualquier categoría personalizada presente en los negocios
    businesses.forEach(b => {
      if (b.category && !list.some(c => c.id === b.category)) {
        list.push({
          id: b.category,
          name: b.categoryLabel || b.category,
          icon: 'fa-tag'
        });
      }
    });

    return list;
  }

  // --- NEGOCIOS ---
  getBusinesses() {
    let list = (this.businessesCache && this.businessesCache.length > 0)
      ? this.businessesCache
      : (JSON.parse(localStorage.getItem(STORAGE_KEYS.BUSINESSES) || 'null') || INITIAL_BUSINESSES);
    
    // Normalizar límites y precios de planes para asegurar coherencia total
    return list.map(b => {
      const plan = b.plan || 'basic';
      if (plan === 'free') {
        return { ...b, plan: 'free', monthlyBookingLimit: 25, planPriceUsd: 0.00 };
      }
      if (plan === 'pro') {
        return { ...b, plan: 'pro', monthlyBookingLimit: (b.monthlyBookingLimit && b.monthlyBookingLimit > 300) ? b.monthlyBookingLimit : 300, planPriceUsd: 18.00 };
      }
      if (plan === 'basic') {
        return { ...b, plan: 'basic', monthlyBookingLimit: 150, planPriceUsd: 10.00 };
      }
      if (plan === 'unlimited') {
        return { ...b, plan: 'unlimited', monthlyBookingLimit: null, planPriceUsd: 35.00 };
      }
      return b;
    });
  }

  getBusinessById(id) {
    const businesses = this.getBusinesses();
    return businesses.find(b => b.id === id) || null;
  }

  async saveBusiness(businessData) {
    if (this.isOnlineApi) {
      try {
        const existing = this.getBusinessById(businessData.id);
        if (existing) {
          await fetch(`${this.apiBase}/businesses/${businessData.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(businessData)
          });
        } else {
          await fetch(`${this.apiBase}/businesses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(businessData)
          });
        }
        await this.loadFromApi();
        return businessData.id;
      } catch (e) {
        console.error('Error guardando en API Neon:', e);
      }
    }

    const businesses = this.getBusinesses();
    const existingIndex = businesses.findIndex(b => b.id === businessData.id);
    if (existingIndex >= 0) {
      businesses[existingIndex] = { ...businesses[existingIndex], ...businessData };
    } else {
      businesses.push({
        ...businessData,
        id: businessData.id || `biz-${Date.now()}`
      });
    }
    localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(businesses));
    this.businessesCache = businesses;
    return businessData.id;
  }

  async deleteBusiness(businessId) {
    if (this.isOnlineApi) {
      try {
        await fetch(`${this.apiBase}/developer/businesses/${businessId}`, { method: 'DELETE' });
        await this.loadFromApi();
        return true;
      } catch (e) {
        console.error('Error eliminando negocio en API:', e);
      }
    }
    const businesses = this.getBusinesses().filter(b => b.id !== businessId);
    localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(businesses));
    this.businessesCache = businesses;
    return true;
  }

  async deleteBusinessByDeveloper(businessId) {
    return this.deleteBusiness(businessId);
  }

  async toggleBusinessBlock(businessId, isBlocked, reason = '') {
    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/developer/businesses/${businessId}/block`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isBlocked, reason })
        });
        if (res.ok) {
          await this.loadFromApi();
          return await res.json();
        }
      } catch (e) {
        console.error('Error bloqueando negocio en API:', e);
      }
    }

    const businesses = this.getBusinesses();
    const biz = businesses.find(b => b.id === businessId);
    if (biz) {
      biz.isBlocked = Boolean(isBlocked);
      biz.blockReason = reason;
      localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(businesses));
      this.businessesCache = businesses;
    }
    return { success: true, isBlocked };
  }

  async toggleBusinessVisibility(businessId, isHidden) {
    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/developer/businesses/${businessId}/visibility`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isHidden })
        });
        if (res.ok) {
          await this.loadFromApi();
          return await res.json();
        }
      } catch (e) {
        console.error('Error actualizando visibilidad en API:', e);
      }
    }

    const businesses = this.getBusinesses();
    const biz = businesses.find(b => b.id === businessId);
    if (biz) {
      biz.isHidden = Boolean(isHidden);
      localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(businesses));
      this.businessesCache = businesses;
    }
    return { success: true, isHidden };
  }

  getActiveBusinessId() {
    const user = this.getBusinessUser();
    if (user && user.businessId) return user.businessId;
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_BUSINESS_ID) || 'biz-1';
  }

  setActiveBusinessId(id) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_BUSINESS_ID, id);
  }

  async updateBusinessAutoConfirm(businessId, autoConfirmAppointments) {
    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/businesses/${businessId}/auto-confirm`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ autoConfirmAppointments })
        });
        if (res.ok) {
          await this.loadFromApi();
          return true;
        }
      } catch (e) {
        console.error('Error actualizando autoconfirmación en API Neon:', e);
      }
    }

    const businesses = this.getBusinesses();
    const biz = businesses.find(b => b.id === businessId);
    if (biz) {
      biz.autoConfirmAppointments = autoConfirmAppointments;
      localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(businesses));
      this.businessesCache = businesses;
    }
    return true;
  }



  // --- SERVICIOS ---
  async addService(businessId, serviceData) {
    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/businesses/${businessId}/services`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(serviceData)
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Error al agregar servicio');
        }
        const created = await res.json();
        await this.loadFromApi();
        return created;
      } catch (e) {
        console.error('Error agregando servicio a API:', e);
        throw e;
      }
    }

    const businesses = this.getBusinesses();
    const business = businesses.find(b => b.id === businessId);
    if (!business) return null;

    const plan = business.plan || 'free';
    if (plan === 'free' && (business.services && business.services.length >= 5)) {
      throw new Error('Has alcanzado el límite de 5 servicios del Plan Gratis. Mejora tu plan para agregar servicios ilimitados.');
    }

    const newService = {
      id: `srv-${Date.now()}`,
      name: serviceData.name,
      duration: parseInt(serviceData.duration, 10) || 30,
      price: parseFloat(serviceData.price) || 0,
      description: serviceData.description || ''
    };

    if (!business.services) business.services = [];
    business.services.push(newService);
    localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(businesses));
    this.businessesCache = businesses;
    return newService;
  }

  async updateService(businessId, serviceId, serviceData) {
    if (this.isOnlineApi) {
      try {
        await fetch(`${this.apiBase}/services/${serviceId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(serviceData)
        });
        await this.loadFromApi();
        return true;
      } catch (e) {
        console.error('Error actualizando servicio en API Neon:', e);
      }
    }

    const businesses = this.getBusinesses();
    const business = businesses.find(b => b.id === businessId);
    if (!business || !business.services) return false;

    const sIndex = business.services.findIndex(s => s.id === serviceId);
    if (sIndex === -1) return false;

    business.services[sIndex] = {
      ...business.services[sIndex],
      ...serviceData,
      duration: parseInt(serviceData.duration, 10) || business.services[sIndex].duration,
      price: parseFloat(serviceData.price) || business.services[sIndex].price
    };

    localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(businesses));
    this.businessesCache = businesses;
    return true;
  }

  async deleteService(businessId, serviceId) {
    if (this.isOnlineApi) {
      try {
        await fetch(`${this.apiBase}/services/${serviceId}`, { method: 'DELETE' });
        await this.loadFromApi();
        return true;
      } catch (e) {
        console.error('Error eliminando servicio en API Neon:', e);
      }
    }

    const businesses = this.getBusinesses();
    const business = businesses.find(b => b.id === businessId);
    if (!business || !business.services) return false;

    business.services = business.services.filter(s => s.id !== serviceId);
    localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(businesses));
    this.businessesCache = businesses;
    return true;
  }

  // ==========================================
  // GESTIÓN DE EQUIPO / ESPECIALISTAS (STAFF)
  // ==========================================
  async getBusinessStaff(businessId) {
    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/businesses/${businessId}/staff`);
        if (res.ok) {
          const staff = await res.json();
          this.staffCache = this.staffCache || {};
          this.staffCache[businessId] = staff;
          localStorage.setItem(`directorio_staff_${businessId}`, JSON.stringify(staff));
          return staff;
        }
      } catch (e) {
        console.warn('Fallback local para staff:', e);
      }
    }
    const local = localStorage.getItem(`directorio_staff_${businessId}`);
    return local ? JSON.parse(local) : [];
  }

  getBusinessStaffSync(businessId) {
    if (this.staffCache && this.staffCache[businessId]) {
      return this.staffCache[businessId];
    }
    const local = localStorage.getItem(`directorio_staff_${businessId}`);
    return local ? JSON.parse(local) : [];
  }

  async createStaffMember(businessId, staffData) {
    if (this.isOnlineApi) {
      const res = await fetch(`${this.apiBase}/businesses/${businessId}/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staffData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al agregar especialista.');
      await this.getBusinessStaff(businessId);
      return data;
    }
    const staff = this.getBusinessStaffSync(businessId);
    const newMember = {
      id: `stf-${Date.now()}`,
      businessId,
      name: staffData.name,
      roleTitle: staffData.roleTitle || 'Especialista',
      avatarUrl: staffData.avatarUrl || '',
      phone: staffData.phone || '',
      services: staffData.services || ['all'],
      schedule: staffData.schedule || null,
      isActive: staffData.isActive !== false,
      createdAt: new Date().toISOString()
    };
    staff.push(newMember);
    this.staffCache = this.staffCache || {};
    this.staffCache[businessId] = staff;
    localStorage.setItem(`directorio_staff_${businessId}`, JSON.stringify(staff));
    return newMember;
  }

  async updateStaffMember(businessId, staffId, staffData) {
    if (this.isOnlineApi) {
      const res = await fetch(`${this.apiBase}/businesses/${businessId}/staff/${staffId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staffData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar especialista.');
      await this.getBusinessStaff(businessId);
      return data;
    }
    const staff = this.getBusinessStaffSync(businessId);
    const idx = staff.findIndex(s => s.id === staffId);
    if (idx >= 0) {
      staff[idx] = { ...staff[idx], ...staffData };
      this.staffCache = this.staffCache || {};
      this.staffCache[businessId] = staff;
      localStorage.setItem(`directorio_staff_${businessId}`, JSON.stringify(staff));
      return staff[idx];
    }
    throw new Error('Especialista no encontrado');
  }

  async deleteStaffMember(businessId, staffId) {
    if (this.isOnlineApi) {
      const res = await fetch(`${this.apiBase}/businesses/${businessId}/staff/${staffId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar especialista.');
      await this.getBusinessStaff(businessId);
      return data;
    }
    let staff = this.getBusinessStaffSync(businessId);
    staff = staff.filter(s => s.id !== staffId);
    this.staffCache = this.staffCache || {};
    this.staffCache[businessId] = staff;
    localStorage.setItem(`directorio_staff_${businessId}`, JSON.stringify(staff));
    return { success: true };
  }

  // --- RESERVAS / CITAS ---
  getAppointments() {
    const data = localStorage.getItem(STORAGE_KEYS.APPOINTMENTS);
    return data ? JSON.parse(data) : INITIAL_APPOINTMENTS;
  }

  async getAppointmentsByBusinessAsync(businessId) {
    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/businesses/${businessId}/appointments`);
        if (res.ok) {
          const data = await res.json();
          const localAll = this.getAppointments().filter(a => a.businessId !== businessId);
          const combined = [...data, ...localAll];
          this.appointmentsCache = combined;
          localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(combined));
          return data;
        }
      } catch (e) {
        console.warn('Fallo al obtener citas remotas de Neon:', e);
      }
    }
    return this.getAppointmentsByBusiness(businessId);
  }

  getAppointmentsByBusiness(businessId) {
    const all = this.appointmentsCache || this.getAppointments();
    return all.filter(a => a.businessId === businessId);
  }

  async getClientAppointmentsAsync(phone, email = '') {
    if (this.isOnlineApi && (phone || email)) {
      try {
        const url = `${this.apiBase}/clients/${encodeURIComponent(phone || 'null')}/appointments?email=${encodeURIComponent(email || '')}`;
        const res = await fetch(url);
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {
        console.warn('Error consultando citas de cliente:', e);
      }
    }
    const all = this.getAppointments();
    return all.filter(a => (phone && a.clientPhone === phone) || (email && a.clientEmail && a.clientEmail.toLowerCase() === email.toLowerCase()));
  }

  async createAppointment(appointmentData) {
    let created = null;
    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/appointments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(appointmentData)
        });
        if (res.ok) {
          created = await res.json();
        } else {
          const errData = await res.json().catch(() => ({}));
          console.warn('API error creando reserva en Neon, guardando local:', errData);
        }
      } catch (e) {
        console.error('Error creando reserva en API Neon:', e);
      }
    }

    if (!created) {
      created = {
        id: `apt-${Date.now().toString().slice(-6)}`,
        ...appointmentData,
        status: appointmentData.status || 'confirmed',
        createdAt: new Date().toISOString()
      };
    }

    const appointments = this.getAppointments().filter(a => a.id !== created.id);
    appointments.unshift(created);
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));
    this.appointmentsCache = appointments;
    return created;
  }

  async updateAppointment(appointmentId, updatedData) {
    if (this.isOnlineApi) {
      try {
        await fetch(`${this.apiBase}/appointments/${appointmentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedData)
        });
      } catch (e) {
        console.error('Error actualizando y reprogramando cita en Neon:', e);
      }
    }

    const appointments = this.getAppointments();
    const appt = appointments.find(a => a.id === appointmentId);
    if (appt) {
      Object.assign(appt, updatedData);
      localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));
      this.appointmentsCache = appointments;
    }
    return true;
  }

  async updateAppointmentStatus(appointmentId, newStatus) {
    if (this.isOnlineApi) {
      try {
        await fetch(`${this.apiBase}/appointments/${appointmentId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });
      } catch (e) {
        console.error('Error actualizando estado en Neon:', e);
      }
    }

    const appointments = this.getAppointments();
    const appt = appointments.find(a => a.id === appointmentId);
    if (appt) {
      appt.status = newStatus;
      localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));
      this.appointmentsCache = appointments;
    }
    return true;
  }

  async deleteAppointment(appointmentId) {
    if (this.isOnlineApi) {
      try {
        await fetch(`${this.apiBase}/appointments/${appointmentId}`, { method: 'DELETE' });
      } catch (e) {
        console.error('Error eliminando cita en Neon:', e);
      }
    }

    let appointments = this.getAppointments();
    appointments = appointments.filter(a => a.id !== appointmentId);
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));
    this.appointmentsCache = appointments;
    return true;
  }

  // ==========================================
  // GESTIÓN DE HORARIOS BLOQUEADOS POR EL COMERCIO
  // ==========================================
  getBlockedSlots(businessId = null, dateString = null) {
    let slots = this.blockedSlotsCache;
    if (!slots || slots.length === 0) {
      const local = localStorage.getItem(STORAGE_KEYS.BLOCKED_SLOTS);
      slots = local ? JSON.parse(local) : [];
      this.blockedSlotsCache = slots;
    }
    if (businessId) {
      slots = slots.filter(s => s.businessId === businessId);
    }
    if (dateString) {
      slots = slots.filter(s => s.date === dateString);
    }
    return slots;
  }

  isSlotBlocked(businessId, dateString, timeStr) {
    const slots = this.getBlockedSlots(businessId, dateString);
    const parseM = (t) => {
      if (!t) return -1;
      let s = String(t).trim().toUpperCase();
      const isPM = s.includes('PM');
      const isAM = s.includes('AM');
      s = s.replace(/[APM\s]/g, '');
      const [hStr, mStr] = s.split(':');
      let h = parseInt(hStr, 10) || 0;
      const m = parseInt(mStr, 10) || 0;
      if (isPM && h < 12) h += 12;
      if (isAM && h === 12) h = 0;
      return h * 60 + m;
    };
    const targetMin = parseM(timeStr);
    return slots.some(s => parseM(s.time) === targetMin);
  }

  async toggleBlockedSlot(businessId, dateString, timeStr) {
    const parseM = (t) => {
      if (!t) return -1;
      let s = String(t).trim().toUpperCase();
      const isPM = s.includes('PM');
      const isAM = s.includes('AM');
      s = s.replace(/[APM\s]/g, '');
      const [hStr, mStr] = s.split(':');
      let h = parseInt(hStr, 10) || 0;
      const m = parseInt(mStr, 10) || 0;
      if (isPM && h < 12) h += 12;
      if (isAM && h === 12) h = 0;
      return h * 60 + m;
    };
    const targetMin = parseM(timeStr);

    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/businesses/${businessId}/blocked-slots/toggle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: dateString, time: timeStr })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.action === 'unblocked') {
            if (Array.isArray(data.removedIds) && data.removedIds.length > 0) {
              const removedSet = new Set(data.removedIds);
              this.blockedSlotsCache = this.blockedSlotsCache.filter(s => !removedSet.has(s.id));
            } else {
              this.blockedSlotsCache = this.blockedSlotsCache.filter(
                s => !(s.businessId === businessId && s.date === dateString && parseM(s.time) === targetMin)
              );
            }
          } else if (data.action === 'blocked') {
            this.blockedSlotsCache = this.blockedSlotsCache.filter(
              s => !(s.businessId === businessId && s.date === dateString && parseM(s.time) === targetMin)
            );
            this.blockedSlotsCache.push({
              id: data.id || `blk-${Date.now()}`,
              businessId,
              date: dateString,
              time: timeStr
            });
          }
          localStorage.setItem(STORAGE_KEYS.BLOCKED_SLOTS, JSON.stringify(this.blockedSlotsCache));
          return data;
        }
      } catch (e) {
        console.warn('Error alternando bloqueo en API:', e);
      }
    }

    // Modo local / Fallback
    const existingIdx = this.blockedSlotsCache.findIndex(
      s => s.businessId === businessId && s.date === dateString && parseM(s.time) === targetMin
    );
    let action = 'blocked';
    if (existingIdx >= 0) {
      this.blockedSlotsCache.splice(existingIdx, 1);
      action = 'unblocked';
    } else {
      this.blockedSlotsCache.push({
        id: `blk-${Date.now()}`,
        businessId,
        date: dateString,
        time: timeStr
      });
      action = 'blocked';
    }
    localStorage.setItem(STORAGE_KEYS.BLOCKED_SLOTS, JSON.stringify(this.blockedSlotsCache));
    return { success: true, action, date: dateString, time: timeStr };
  }

  async setDayBlockedSlots(businessId, dateString, times, action) {
    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/businesses/${businessId}/blocked-slots/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: dateString, times, action })
        });
        if (res.ok) {
          if (action === 'unblock_all') {
            this.blockedSlotsCache = this.blockedSlotsCache.filter(
              s => !(s.businessId === businessId && s.date === dateString)
            );
          } else if (action === 'block_all') {
            this.blockedSlotsCache = this.blockedSlotsCache.filter(
              s => !(s.businessId === businessId && s.date === dateString)
            );
            times.forEach(t => {
              this.blockedSlotsCache.push({
                id: `blk-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                businessId,
                date: dateString,
                time: t
              });
            });
          }
          localStorage.setItem(STORAGE_KEYS.BLOCKED_SLOTS, JSON.stringify(this.blockedSlotsCache));
          return await res.json();
        }
      } catch (e) {
        console.warn('Error en bulk slots API:', e);
      }
    }

    // Modo local
    if (action === 'unblock_all') {
      this.blockedSlotsCache = this.blockedSlotsCache.filter(
        s => !(s.businessId === businessId && s.date === dateString)
      );
    } else if (action === 'block_all' && Array.isArray(times)) {
      this.blockedSlotsCache = this.blockedSlotsCache.filter(
        s => !(s.businessId === businessId && s.date === dateString)
      );
      times.forEach(t => {
        this.blockedSlotsCache.push({
          id: `blk-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          businessId,
          date: dateString,
          time: t
        });
      });
    }
    localStorage.setItem(STORAGE_KEYS.BLOCKED_SLOTS, JSON.stringify(this.blockedSlotsCache));
    return { success: true, action, date: dateString };
  }

  // --- CÁLCULO DE DISPONIBILIDAD EN TIEMPO REAL CON MULTI-ESPECIALISTA ---
  getAvailableSlots(businessId, dateString, serviceDurationMinutes = 30, excludeAppointmentId = null, selectedStaffId = 'any', serviceId = null) {
    const business = this.getBusinessById(businessId);
    if (!business || !business.schedule) return { isClosed: false, slots: [] };

    const [year, month, day] = dateString.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = dateObj.getDay();

    if (!business.schedule.days || !business.schedule.days.includes(dayOfWeek)) {
      return { isClosed: true, reason: 'El negocio no labora en este día de la semana.', slots: [] };
    }

    const timeToMinutes = (timeStr) => {
      if (!timeStr) return 0;
      let str = String(timeStr).trim().toUpperCase();
      const isPM = str.includes('PM');
      const isAM = str.includes('AM');
      str = str.replace(/[APM\s]/g, '');
      const [hStr, mStr] = str.split(':');
      let h = parseInt(hStr, 10) || 0;
      const m = parseInt(mStr, 10) || 0;
      if (isPM && h < 12) h += 12;
      if (isAM && h === 12) h = 0;
      return h * 60 + m;
    };

    const minutesToTime = (totalMinutes) => {
      const totalH = Math.floor(totalMinutes / 60);
      const m = (totalMinutes % 60).toString().padStart(2, '0');
      const period = totalH >= 12 ? 'PM' : 'AM';
      let hour12 = totalH % 12;
      if (hour12 === 0) hour12 = 12;
      return `${hour12}:${m} ${period}`;
    };

    const openMin = timeToMinutes(business.schedule.openTime || '09:00');
    const closeMin = timeToMinutes(business.schedule.closeTime || '18:00');
    const breakStartMin = business.schedule.breakStart ? timeToMinutes(business.schedule.breakStart) : -1;
    const breakEndMin = business.schedule.breakEnd ? timeToMinutes(business.schedule.breakEnd) : -1;
    const slotStep = business.schedule.slotDuration || 30;
    const serviceDur = parseInt(serviceDurationMinutes, 10) || 30;

    // Obtener equipo activo
    const allStaff = (this.getBusinessStaffSync(businessId) || []).filter(s => s.isActive !== false);

    // Filtrar staff calificado para el servicio si se proporcionó serviceId
    const qualifiedStaff = allStaff.filter(st => {
      if (!serviceId) return true;
      if (!st.services || st.services.length === 0 || st.services.includes('all')) return true;
      return st.services.includes(serviceId);
    });

    const existingAppointments = this.getAppointmentsByBusiness(businessId).filter(
      appt => appt.date === dateString && appt.status !== 'cancelled' && (!excludeAppointmentId || appt.id !== excludeAppointmentId)
    );

    // Franjas horarias bloqueadas manualmente por el negocio
    const blockedSlots = this.getBlockedSlots(businessId, dateString);
    const blockedRanges = blockedSlots.map(b => {
      const start = timeToMinutes(b.time);
      const is15MinSlot = (start % 30 !== 0);
      const bDuration = is15MinSlot ? 15 : (slotStep === 15 ? 15 : 30);
      return { start, end: start + bDuration };
    });

    const availableSlots = [];

    // Helper para verificar si un miembro del personal está disponible en un rango [slotStart, slotEnd]
    const isStaffMemberAvailable = (st, slotStart, slotEnd) => {
      const stSchedule = st.schedule || business.schedule;
      if (stSchedule.days && !stSchedule.days.includes(dayOfWeek)) {
        return false;
      }
      const stOpen = timeToMinutes(stSchedule.openTime || business.schedule.openTime || '09:00');
      const stClose = timeToMinutes(stSchedule.closeTime || business.schedule.closeTime || '18:00');
      if (slotStart < stOpen || slotEnd > stClose) {
        return false;
      }
      if (stSchedule.breakStart && stSchedule.breakEnd) {
        const bStart = timeToMinutes(stSchedule.breakStart);
        const bEnd = timeToMinutes(stSchedule.breakEnd);
        if (slotStart < bEnd && slotEnd > bStart) {
          return false;
        }
      }
      const staffBooked = existingAppointments.filter(appt => appt.staffId === st.id);
      const hasConflict = staffBooked.some(appt => {
        const start = timeToMinutes(appt.time);
        const duration = appt.serviceDuration || 30;
        return (slotStart < start + duration && slotEnd > start);
      });
      return !hasConflict;
    };

    for (let current = openMin; current + serviceDur <= closeMin; current += slotStep) {
      const slotEnd = current + serviceDur;

      // Franja de bloqueo manual del negocio
      const hasBlockedConflict = blockedRanges.some(blocked => {
        return (current < blocked.end && slotEnd > blocked.start);
      });
      if (hasBlockedConflict) continue;

      // CASO A: Sin especialistas configurados (1 solo operador / dueño)
      if (allStaff.length === 0) {
        if (breakStartMin !== -1 && breakEndMin !== -1) {
          const overlapsBreak = (current < breakEndMin && slotEnd > breakStartMin);
          if (overlapsBreak) continue;
        }
        const hasConflict = existingAppointments.some(appt => {
          const start = timeToMinutes(appt.time);
          const duration = appt.serviceDuration || 30;
          return (current < start + duration && slotEnd > start);
        });
        if (hasConflict) continue;
        availableSlots.push(minutesToTime(current));
        continue;
      }

      // CASO B: Especialista Específico seleccionado
      if (selectedStaffId && selectedStaffId !== 'any') {
        const targetStaff = qualifiedStaff.find(s => s.id === selectedStaffId);
        if (!targetStaff) continue;
        if (isStaffMemberAvailable(targetStaff, current, slotEnd)) {
          availableSlots.push(minutesToTime(current));
        }
        continue;
      }

      // CASO C: "Cualquiera Disponible" ('any')
      const freeStaffCount = qualifiedStaff.filter(st => isStaffMemberAvailable(st, current, slotEnd)).length;
      
      // Citas sin especialista asignado que ocupan cupo
      const unassignedCount = existingAppointments.filter(appt => {
        if (appt.staffId) return false;
        const start = timeToMinutes(appt.time);
        const duration = appt.serviceDuration || 30;
        return (current < start + duration && slotEnd > start);
      }).length;

      if ((freeStaffCount - unassignedCount) > 0) {
        availableSlots.push(minutesToTime(current));
      }
    }

    // Filtrar turnos pasados si la fecha seleccionada es hoy (con margen de 15 minutos)
    const todayStr = (() => {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    })();

    let filteredSlots = availableSlots;
    if (dateString === todayStr) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const minAllowedMinutes = currentMinutes + 15; // 15 minutos de margen
      filteredSlots = availableSlots.filter(slot => {
        const slotMin = timeToMinutes(slot);
        return slotMin >= minAllowedMinutes;
      });
    }

    return {
      isClosed: false,
      slots: filteredSlots
    };
  }

  // ==========================================
  // PLANES DE SUSCRIPCIÓN ($6, $15, $25)
  // ==========================================
  getSubscriptionPlans() {
    return SUBSCRIPTION_PLANS;
  }

  getPlanById(planId) {
    const plans = this.getSubscriptionPlans();
    return plans.find(p => p.id === planId) || plans[0];
  }

  async updateBusinessPlan(businessId, planId) {
    const plan = this.getPlanById(planId);
    if (!plan) throw new Error('Plan inválido seleccionado.');

    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/businesses/${businessId}/plan`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan: plan.id,
            planPriceUsd: plan.priceUsd,
            monthlyBookingLimit: plan.bookingLimit
          })
        });
        if (res.ok) {
          const updated = await res.json();
          await this.loadFromApi();
          return updated;
        }
      } catch (e) {
        console.error('Error actualizando plan en API:', e);
      }
    }

    // Fallback local
    const businesses = this.getBusinesses();
    const idx = businesses.findIndex(b => b.id === businessId);
    if (idx >= 0) {
      businesses[idx].plan = plan.id;
      businesses[idx].planPriceUsd = plan.priceUsd;
      businesses[idx].monthlyBookingLimit = plan.bookingLimit;
      localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(businesses));
      this.businessesCache = businesses;
      return businesses[idx];
    }
    throw new Error('No se encontró el negocio para actualizar plan.');
  }

  async setDeveloperBusinessPlan(businessId, planId) {
    const plan = this.getPlanById(planId);
    if (!plan) throw new Error('Plan inválido seleccionado.');

    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/developer/businesses/${businessId}/plan`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: plan.id })
        });
        if (res.ok) {
          const data = await res.json();
          await this.loadFromApi();
          return data;
        }
      } catch (e) {
        console.error('Error actualizando plan como developer:', e);
      }
    }
    return this.updateBusinessPlan(businessId, planId);
  }

  async getBusinessBookingUsage(businessId) {
    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/businesses/${businessId}/booking-usage`);
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {
        console.warn('Error obteniendo uso de reservas:', e);
      }
    }

    // Fallback local
    const biz = this.getBusinessById(businessId);
    const plan = this.getPlanById(biz ? (biz.plan || 'free') : 'free');
    const limit = plan ? plan.bookingLimit : 25;
    
    const now = new Date();
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const all = this.getAppointmentsByBusiness(businessId);
    const used = all.filter(a => (a.date || '').startsWith(curMonth) && a.status !== 'cancelled').length;
    const remaining = limit ? Math.max(0, limit - used) : null;
    const percent = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;

    return {
      plan: plan ? plan.id : 'free',
      planPriceUsd: plan ? plan.priceUsd : 0,
      monthlyBookingLimit: limit,
      usedThisMonth: used,
      remainingThisMonth: remaining,
      usagePercent: percent,
      isUnlimited: !limit,
      isLimitReached: limit ? used >= limit : false
    };
  }

  // --- CONFIGURACIÓN DE WHATSAPP / META DEVELOPER ---
  async getWhatsAppSettings() {
    try {
      const res = await fetch(`${this.apiBase}/developer/settings/whatsapp`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.error('Error fetching whatsapp settings:', e);
    }
    return { configured: false, tokenMasked: '', phoneNumberId: '', wabaId: '' };
  }

  async saveWhatsAppSettings(settings) {
    try {
      const res = await fetch(`${this.apiBase}/developer/settings/whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) return await res.json();
      const err = await res.json();
      throw new Error(err.error || 'Error al guardar credenciales.');
    } catch (e) {
      console.error('Error saving whatsapp settings:', e);
      throw e;
    }
  }

  async testWhatsAppNotification(phone) {
    try {
      const res = await fetch(`${this.apiBase}/test-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      return await res.json();
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // --- RESEÑAS Y CALIFICACIONES VERIFICADAS ---
  async getReviewInfo(appointmentId) {
    try {
      const res = await fetch(`${this.apiBase}/appointments/${appointmentId}/review-info`);
      if (res.ok) return await res.json();
      const err = await res.json();
      return { error: err.error || 'No se pudo obtener información de la cita.' };
    } catch (e) {
      return { error: e.message || 'Error de conexión con el servidor.' };
    }
  }

  async submitReview(reviewData) {
    try {
      const res = await fetch(`${this.apiBase}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewData)
      });
      const data = await res.json();
      if (res.ok) {
        // Actualizar el estado de calificación de la cita localmente
        if (reviewData.appointmentId) {
          const appts = this.getAppointments();
          const target = appts.find(a => String(a.id).toLowerCase() === String(reviewData.appointmentId).toLowerCase());
          if (target) {
            target.isReviewed = true;
            target.reviewRating = parseInt(reviewData.rating, 10);
            target.reviewComment = reviewData.comment || '';
            localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appts));
            this.appointmentsCache = appts;
          }
        }
        // Refrescar caché de comercios local
        await this.loadFromApi();
        return data;
      }
      throw new Error(data.error || 'Error al enviar calificación.');
    } catch (e) {
      throw e;
    }
  }

  async getBusinessReviews(businessId) {
    try {
      const res = await fetch(`${this.apiBase}/businesses/${businessId}/reviews`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Error consultando reseñas del negocio:', e);
    }
    return [];
  }

  async testReviewEmail(email) {
    try {
      const res = await fetch(`${this.apiBase}/test-review-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      return await res.json();
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // --- PRE-REGISTRO DE COMERCIOS (LEADS DE PRELANZAMIENTO) ---
  async savePreRegistration(leadData) {
    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/pre-registrations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(leadData)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al guardar pre-registro.');
        
        // Guardar copia de seguridad en localStorage
        const stored = JSON.parse(localStorage.getItem('reservas_pre_registrations') || '[]');
        stored.unshift(data.lead || { ...leadData, id: data.id, createdAt: new Date().toISOString() });
        localStorage.setItem('reservas_pre_registrations', JSON.stringify(stored));
        
        return data;
      } catch (e) {
        console.warn('Fallback local para pre-registro:', e);
      }
    }

    const fallbackLead = {
      id: `prereg-${Date.now()}`,
      ...leadData,
      createdAt: new Date().toISOString()
    };
    const stored = JSON.parse(localStorage.getItem('reservas_pre_registrations') || '[]');
    stored.unshift(fallbackLead);
    localStorage.setItem('reservas_pre_registrations', JSON.stringify(stored));
    return { success: true, message: '¡Pre-registro guardado con éxito!', lead: fallbackLead };
  }

  async getPreRegistrations() {
    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/pre-registrations`);
        if (res.ok) {
          const data = await res.json();
          if (data.leads) {
            localStorage.setItem('reservas_pre_registrations', JSON.stringify(data.leads));
            return data.leads;
          }
        }
      } catch (e) {
        console.warn('Error consultando pre-registros del servidor:', e);
      }
    }
    return JSON.parse(localStorage.getItem('reservas_pre_registrations') || '[]');
  }

  async savePreRegistrationByDeveloper(leadData) {
    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/developer/pre-registrations/${leadData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(leadData)
        });
        if (res.ok) {
          const data = await res.json();
          await this.getPreRegistrations();
          return data;
        }
        const err = await res.json();
        throw new Error(err.error || 'Error al actualizar pre-registro.');
      } catch (e) {
        if (this.isOnlineApi) throw e;
      }
    }

    const stored = JSON.parse(localStorage.getItem('reservas_pre_registrations') || '[]');
    const idx = stored.findIndex(pr => pr.id === leadData.id);
    if (idx >= 0) {
      stored[idx] = { ...stored[idx], ...leadData };
    }
    localStorage.setItem('reservas_pre_registrations', JSON.stringify(stored));
    return { success: true };
  }

  async togglePreRegistrationBlock(prId, isBlocked, reason = '') {
    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/developer/pre-registrations/${prId}/block`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isBlocked, reason })
        });
        if (res.ok) {
          const data = await res.json();
          await this.getPreRegistrations();
          return data;
        }
        const err = await res.json();
        throw new Error(err.error || 'Error al actualizar estado del pre-registro.');
      } catch (e) {
        if (this.isOnlineApi) throw e;
      }
    }

    const stored = JSON.parse(localStorage.getItem('reservas_pre_registrations') || '[]');
    const item = stored.find(pr => pr.id === prId);
    if (item) {
      item.isBlocked = Boolean(isBlocked);
      item.blockReason = reason;
      item.status = isBlocked ? 'discarded' : 'pending';
      localStorage.setItem('reservas_pre_registrations', JSON.stringify(stored));
    }
    return { success: true, isBlocked };
  }

  async deletePreRegistrationByDeveloper(prId) {
    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/developer/pre-registrations/${prId}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          await this.getPreRegistrations();
          return await res.json();
        }
        const err = await res.json();
        throw new Error(err.error || 'Error al eliminar pre-registro.');
      } catch (e) {
        if (this.isOnlineApi) throw e;
      }
    }

    let stored = JSON.parse(localStorage.getItem('reservas_pre_registrations') || '[]');
    stored = stored.filter(pr => pr.id !== prId);
    localStorage.setItem('reservas_pre_registrations', JSON.stringify(stored));
    return { success: true };
  }

  // --- MÉTODOS DE CLIENTES / USUARIOS PARA DEVELOPER ---
  async saveClientByDeveloper(clientData) {
    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/developer/clients/${clientData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(clientData)
        });
        if (res.ok) {
          return await res.json();
        }
        const err = await res.json();
        throw new Error(err.error || 'Error al actualizar usuario cliente.');
      } catch (e) {
        if (this.isOnlineApi) throw e;
      }
    }

    const clientUser = this.getClientUser();
    if (clientUser && clientUser.id === clientData.id) {
      this.setClientUser({ ...clientUser, ...clientData });
    }
    return { success: true };
  }

  async toggleClientBlock(clientId, isBlocked, reason = '') {
    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/developer/clients/${clientId}/block`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isBlocked, reason })
        });
        if (res.ok) {
          return await res.json();
        }
        const err = await res.json();
        throw new Error(err.error || 'Error al bloquear usuario cliente.');
      } catch (e) {
        if (this.isOnlineApi) throw e;
      }
    }

    const clientUser = this.getClientUser();
    if (clientUser && clientUser.id === clientId) {
      clientUser.isBlocked = Boolean(isBlocked);
      clientUser.blockReason = reason;
      this.setClientUser(clientUser);
    }
    return { success: true, isBlocked };
  }

  async deleteClientByDeveloper(clientId) {
    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/developer/clients/${clientId}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          return await res.json();
        }
        const err = await res.json();
        throw new Error(err.error || 'Error al eliminar usuario cliente.');
      } catch (e) {
        if (this.isOnlineApi) throw e;
      }
    }

    const clientUser = this.getClientUser();
    if (clientUser && clientUser.id === clientId) {
      this.logoutClient();
    }
    return { success: true };
  }

  // --- INTEGRACIÓN PAYPAL ---
  async getPayPalConfig() {
    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/paypal/config`);
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {
        console.warn('Error consultando config de PayPal:', e);
      }
    }
    return {
      success: true,
      clientId: 'BAAsEQDC0BKe7tSW6HzeTRQaXGSaWDvD2WkilEkv31h9Ttq2K2phZ8RGMOp9SyNN-sM0wuAnBVMVPr7YHo',
      env: 'live',
      currency: 'USD',
      plans: {
        test: 'P-8U675044DY030573GNKVATZQ',
        basic: 'P-2J419336TA519012VNKU75PY',
        pro: 'P-3ER02078XB861273LNKU75QA',
        unlimited: 'P-8VC868094T599031CNKU75QA'
      }
    };
  }

  async verifyPayPalSubscription(subscriptionId, businessId, planId) {
    if (this.isOnlineApi) {
      const res = await fetch(`${this.apiBase}/paypal/verify-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId, businessId, planId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo verificar la suscripción.');
      await this.loadFromApi();
      return data;
    }

    // Fallback local
    const businesses = this.getBusinesses();
    const biz = businesses.find(b => b.id === businessId);
    if (biz) {
      const plan = this.getPlanById(planId);
      biz.plan = planId;
      biz.planPriceUsd = plan ? plan.priceUsd : 18;
      biz.monthlyBookingLimit = plan ? plan.bookingLimit : 300;
      biz.paypalSubscriptionId = subscriptionId;
      biz.subscriptionStatus = 'active';
      localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(businesses));
      this.businessesCache = businesses;
    }
    return { success: true, message: 'Plan activado localmente.' };
  }

  async createPayPalOrder(businessId, planId) {
    if (this.isOnlineApi) {
      const res = await fetch(`${this.apiBase}/paypal/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, planId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo crear la orden en PayPal.');
      return data;
    }
    return { success: true, orderId: 'ORDER-' + Date.now() };
  }

  async capturePayPalOrder(orderId, businessId, planId) {
    if (this.isOnlineApi) {
      const res = await fetch(`${this.apiBase}/paypal/capture-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, businessId, planId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo capturar el pago en PayPal.');
      await this.loadFromApi();
      return data;
    }

    const businesses = this.getBusinesses();
    const biz = businesses.find(b => b.id === businessId);
    if (biz) {
      const plan = this.getPlanById(planId);
      biz.plan = planId;
      biz.planPriceUsd = plan ? plan.priceUsd : 18;
      biz.monthlyBookingLimit = plan ? plan.bookingLimit : 300;
      biz.paypalSubscriptionId = orderId;
      biz.subscriptionStatus = 'active';
      localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(businesses));
      this.businessesCache = businesses;
    }
    return { success: true, message: 'Pago procesado localmente.' };
  }

  async cancelPayPalSubscription(businessId, reason = 'Cancelado por el usuario') {
    if (this.isOnlineApi) {
      const res = await fetch(`${this.apiBase}/paypal/cancel-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, reason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo cancelar la suscripción.');
      await this.loadFromApi();
      return data;
    }
    return { success: true, message: 'Suscripción cancelada localmente.' };
  }

  async savePayPalSettings(settings) {
    if (this.isOnlineApi) {
      const res = await fetch(`${this.apiBase}/developer/paypal-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      return await res.json();
    }
    return { success: true };
  }

  async syncPayPalPlans() {
    if (this.isOnlineApi) {
      const res = await fetch(`${this.apiBase}/developer/paypal-sync-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al sincronizar planes con PayPal.');
      return data;
    }
    throw new Error('Servidor offline');
  }

  // ==========================================
  // MANTENIMIENTO & EXPORTACIÓN EXCEL DEVELOPER
  // ==========================================
  async getCleanupStats() {
    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/developer/cleanup/stats`);
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {
        console.warn('Error obteniendo estadísticas de limpieza:', e);
      }
    }
    return {
      expiredOtpCodes: 0,
      pastDateBlocks: 0,
      oldCategoryAlerts: 0,
      oldCancelledAppointments: 0,
      handledPreRegistrations: 0,
      totalPurgeable: 0
    };
  }

  async executeDatabaseCleanup(options = {}) {
    if (this.isOnlineApi) {
      const res = await fetch(`${this.apiBase}/developer/cleanup/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al ejecutar la depuración.');
      await this.loadFromApi();
      return data;
    }
    throw new Error('La depuración solo está disponible en modo servidor conectado a base de datos.');
  }

  getProvinces() {
    return COSTA_RICA_PROVINCES;
  }

  getExportExcelUrl({ businessId = 'all', status = 'completed', startDate = '', endDate = '' } = {}) {
    const params = new URLSearchParams();
    if (businessId) params.append('businessId', businessId);
    if (status) params.append('status', status);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return `${this.apiBase}/developer/export/appointments-excel?${params.toString()}`;
  }
}

export const storage = new StorageService();
export default storage;

