// Servicio de almacenamiento conectado a Neon PostgreSQL con autenticación de Negocios y Clientes
import { INITIAL_BUSINESSES, INITIAL_APPOINTMENTS, INITIAL_CATEGORIES, SUBSCRIPTION_PLANS } from '../data/initialData.js';

const STORAGE_KEYS = {
  BUSINESSES: 'directorio_businesses_v1',
  APPOINTMENTS: 'directorio_appointments_v1',
  ACTIVE_BUSINESS_ID: 'directorio_active_biz_id',
  BIZ_USER: 'directorio_biz_user_session',
  CLIENT_USER: 'directorio_client_user_session',
  DEV_USER: 'directorio_dev_user_session'
};

class StorageService {
  constructor() {
    this.apiBase = '/api';
    this.businessesCache = [];
    this.appointmentsCache = [];
    this.isOnlineApi = true;
    this.init();
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
      const res = await fetch(`${this.apiBase}/auth/client/login-or-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, whatsappOptIn })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error en acceso de cliente.');
      this.setClientUser(data.client);
      return data.client;
    }

    const client = { id: `cli-${Date.now()}`, name, phone, email, whatsappOptIn };
    this.setClientUser(client);
    return client;
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
    if (this.businessesCache && this.businessesCache.length > 0) {
      return this.businessesCache;
    }
    const local = localStorage.getItem(STORAGE_KEYS.BUSINESSES);
    return local ? JSON.parse(local) : INITIAL_BUSINESSES;
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
    const businesses = this.getBusinesses().filter(b => b.id !== businessId);
    localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(businesses));
    this.businessesCache = businesses;
    return true;
  }

  getActiveBusinessId() {
    const user = this.getBusinessUser();
    if (user && user.businessId) return user.businessId;
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_BUSINESS_ID) || 'biz-1';
  }

  setActiveBusinessId(id) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_BUSINESS_ID, id);
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
        const created = await res.json();
        await this.loadFromApi();
        return created;
      } catch (e) {
        console.error('Error agregando servicio a API Neon:', e);
      }
    }

    const businesses = this.getBusinesses();
    const business = businesses.find(b => b.id === businessId);
    if (!business) return null;

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
          this.appointmentsCache = data;
          localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(data));
          return data;
        }
      } catch (e) {
        console.warn('Fallo al obtener citas remotas de Neon:', e);
      }
    }
    return this.getAppointmentsByBusiness(businessId);
  }

  getAppointmentsByBusiness(businessId) {
    if (this.appointmentsCache && this.appointmentsCache.length > 0) {
      const filtered = this.appointmentsCache.filter(a => a.businessId === businessId);
      if (filtered.length > 0) return filtered;
    }
    const all = this.getAppointments();
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
    if (this.isOnlineApi) {
      try {
        const res = await fetch(`${this.apiBase}/appointments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(appointmentData)
        });
        if (res.ok) {
          const created = await res.json();
          await this.getAppointmentsByBusinessAsync(appointmentData.businessId);
          return created;
        }
      } catch (e) {
        console.error('Error creando reserva en API Neon:', e);
      }
    }

    const appointments = this.getAppointments();
    const newAppointment = {
      id: `apt-${Date.now().toString().slice(-6)}`,
      ...appointmentData,
      status: appointmentData.status || 'confirmed',
      createdAt: new Date().toISOString()
    };

    appointments.unshift(newAppointment);
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));
    this.appointmentsCache = appointments;
    return newAppointment;
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

  // --- CÁLCULO DE DISPONIBILIDAD EN TIEMPO REAL ---
  getAvailableSlots(businessId, dateString, serviceDurationMinutes = 30, excludeAppointmentId = null) {
    const business = this.getBusinessById(businessId);
    if (!business || !business.schedule) return [];

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

    const existingAppointments = this.getAppointmentsByBusiness(businessId).filter(
      appt => appt.date === dateString && appt.status !== 'cancelled' && (!excludeAppointmentId || appt.id !== excludeAppointmentId)
    );

    const bookedRanges = existingAppointments.map(appt => {
      const start = timeToMinutes(appt.time);
      const duration = appt.serviceDuration || 30;
      return { start, end: start + duration };
    });

    const availableSlots = [];

    for (let current = openMin; current + serviceDur <= closeMin; current += slotStep) {
      const slotEnd = current + serviceDur;

      if (breakStartMin !== -1 && breakEndMin !== -1) {
        const overlapsBreak = (current < breakEndMin && slotEnd > breakStartMin);
        if (overlapsBreak) continue;
      }

      const hasConflict = bookedRanges.some(booked => {
        return (current < booked.end && slotEnd > booked.start);
      });

      if (!hasConflict) {
        availableSlots.push(minutesToTime(current));
      }
    }

    return {
      isClosed: false,
      slots: availableSlots
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

  // --- CONFIGURACIÓN DE WHATSAPP / META DEVELOPER ---
  async getWhatsAppSettings() {
    if (this.isOnline) {
      try {
        const res = await fetch(`${this.apiBase}/developer/settings/whatsapp`);
        if (res.ok) return await res.json();
      } catch (e) {
        console.error('Error fetching whatsapp settings:', e);
      }
    try {
      const res = await fetch(`${this.apiBase}/developer/settings/whatsapp`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.error('Error fetching whatsapp settings:', e);
    }
    return { configured: false, tokenMasked: '', phoneNumberId: '', wabaId: '' };
  }

  async saveWhatsAppSettings(settings) {
    if (this.isOnline) {
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
    throw new Error('Servidor no disponible para guardar credenciales.');
  }

  async testWhatsAppNotification(phone) {
    if (this.isOnline) {
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
    return { success: false, error: 'Servidor desconectado.' };
  }
}

export const storage = new StorageService();
export default storage;
