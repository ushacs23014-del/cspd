
export type Language = 'en' | 'es';

export const translations = {
  en: {
    nav: {
      detection: 'Detection',
      dashboard: 'Dashboard',
      history: 'Alert History',
      notifications: 'Alert Logs',
      complaints: 'Report Pattern',
      settings: 'Settings',
      logout: 'Log Out',
      audit: 'Audit Logs'
    },
    detect: {
      title: 'AI Scam Detector',
      subtitle: 'Paste any suspicious message, email, or SMS to analyze for potential scam patterns using advanced AI.',
      placeholder: 'Paste your message here...',
      button: 'Scan for Scams',
      scanning: 'Analyzing Message...',
      scamDetected: 'Scam Detected!',
      likelySafe: 'Likely Safe',
      results: 'Analysis Results',
      prediction: 'Prediction',
      risk: 'Risk Level',
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      scam: 'Scam',
      safe: 'Safe',
      confidence: 'Confidence',
      category: 'Category',
      analysis: 'Deep Analysis',
      phrases: 'Suspicious Phrases',
      reasons: 'Key Indicators',
      actions: 'Recommended Actions',
      threatIntel: 'Threat Intelligence Enrichment',
      indicator: 'Indicator',
      reputation: 'Reputation',
      details: 'Details',
      clean: 'Clean',
      suspicious: 'Suspicious',
      malicious: 'Malicious',
      unknown: 'Unknown'
    },
    audit: {
      title: 'Audit Logs',
      action: 'Action',
      resource: 'Resource',
      user: 'User',
      timestamp: 'Timestamp',
      ip: 'IP Address',
      details: 'Details',
      filters: {
        allActions: 'All Actions',
        allResources: 'All Resources'
      }
    },
    dashboard: {
      title: 'Dashboard',
      export: 'Export CSV',
      totalUsers: 'Total Users',
      scamsBlocked: 'Scams Blocked',
      systemStatus: 'System Status',
      active: 'Active',
      riskDist: 'Risk Distribution',
      recentActivity: 'Recent Activity',
      filters: {
        start: 'Start Date',
        end: 'End Date',
        risk: 'Risk Level',
        prediction: 'Prediction',
        reset: 'Reset',
        allRisks: 'All Risks',
        allTypes: 'All Types'
      }
    },
    history: {
      title: 'Alert History',
      search: 'Search messages...',
      table: {
        message: 'Message',
        prediction: 'Prediction',
        risk: 'Risk',
        confidence: 'Confidence',
        date: 'Date',
        user: 'User'
      },
      pagination: 'Showing {count} of {total} results',
      page: 'Page {current} of {total}'
    },
    settings: {
      title: 'Account Settings',
      profile: 'Profile Information',
      name: 'Full Name',
      email: 'Email Address',
      update: 'Update Profile',
      security: 'Security',
      currentPass: 'Current Password',
      newPass: 'New Password',
      confirmPass: 'Confirm New Password',
      changePass: 'Change Password',
      notifications: 'Notifications',
      emailAlerts: 'Email Alerts',
      emailAlertsDesc: 'Receive high-risk alerts via email',
      webhookAlerts: 'Webhook Alerts',
      webhookAlertsDesc: 'Trigger security webhooks for high-risk detections',
      danger: 'Danger Zone',
      deleteDesc: 'Once you delete your account, there is no going back. Please be certain.',
      deleteBtn: 'Delete Account',
      deleteConfirm: 'Are you absolutely sure?',
      deleteYes: 'Yes, Delete My Account',
      cancel: 'Cancel',
      language: 'Language Selection',
      profileSuccess: 'Profile updated successfully!',
      passSuccess: 'Password changed successfully!',
      passMismatch: 'New passwords do not match',
      updateError: 'Failed to update profile',
      passError: 'Failed to change password',
      deleteError: 'Failed to delete account'
    },
    complaints: {
      title: 'Report Suspicious Pattern',
      subtitle: 'Help us improve detection by reporting new scam tactics you\'ve encountered.',
      submitTitle: 'Submit New Report',
      placeholder: 'Describe the scam pattern or paste the message...',
      submitBtn: 'Submit Report',
      success: 'Report submitted successfully!',
      historyTitle: 'My Reports History',
      adminTitle: 'All Reports (Moderation)',
      noReports: 'No reports found.',
      moderate: 'Moderate',
      status: 'Status',
      notes: 'Reviewer Notes',
      notesPlaceholder: 'Add notes for the user...',
      save: 'Save Changes',
      pending: 'Pending',
      inReview: 'In Review',
      resolved: 'Resolved',
      rejected: 'Rejected'
    },
    notifications: {
      title: 'High-Risk Alert Logs',
      table: {
        id: 'Detection ID',
        channel: 'Channel',
        recipient: 'Recipient',
        status: 'Status',
        date: 'Timestamp'
      },
      noLogs: 'No notification logs found.'
    },
    auth: {
      unverified: 'Unverified Email',
      requestVerification: 'Request Verification'
    }
  },
  es: {
    nav: {
      detection: 'Detección',
      dashboard: 'Panel',
      history: 'Historial',
      notifications: 'Registros',
      complaints: 'Reportar Patrón',
      settings: 'Ajustes',
      logout: 'Cerrar Sesión',
      audit: 'Registros de Auditoría'
    },
    detect: {
      title: 'Detector de Estafas IA',
      subtitle: 'Pegue cualquier mensaje, correo o SMS sospechoso para analizar posibles patrones de estafa usando IA avanzada.',
      placeholder: 'Pegue su mensaje aquí...',
      button: 'Escanear Estafas',
      scanning: 'Analizando Mensaje...',
      scamDetected: '¡Estafa Detectada!',
      likelySafe: 'Probablemente Seguro',
      results: 'Resultados del Análisis',
      prediction: 'Predicción',
      risk: 'Nivel de Riesgo',
      low: 'Bajo',
      medium: 'Medio',
      high: 'Alto',
      scam: 'Estafa',
      safe: 'Seguro',
      confidence: 'Confianza',
      category: 'Categoría',
      analysis: 'Análisis Profundo',
      phrases: 'Frases Sospechosas',
      reasons: 'Indicadores Clave',
      actions: 'Acciones Recomendadas',
      threatIntel: 'Enriquecimiento de Inteligencia de Amenazas',
      indicator: 'Indicador',
      reputation: 'Reputación',
      details: 'Detalles',
      clean: 'Limpio',
      suspicious: 'Sospechoso',
      malicious: 'Malicioso',
      unknown: 'Desconocido'
    },
    audit: {
      title: 'Registros de Auditoría',
      action: 'Acción',
      resource: 'Recurso',
      user: 'Usuario',
      timestamp: 'Marca de Tiempo',
      ip: 'Dirección IP',
      details: 'Detalles',
      filters: {
        allActions: 'Todas las Acciones',
        allResources: 'Todos los Recursos'
      }
    },
    dashboard: {
      title: 'Panel de Control',
      export: 'Exportar CSV',
      totalUsers: 'Usuarios Totales',
      scamsBlocked: 'Estafas Bloqueadas',
      systemStatus: 'Estado del Sistema',
      active: 'Activo',
      riskDist: 'Distribución de Riesgo',
      recentActivity: 'Actividad Reciente',
      filters: {
        start: 'Fecha Inicio',
        end: 'Fecha Fin',
        risk: 'Nivel de Riesgo',
        prediction: 'Predicción',
        reset: 'Reiniciar',
        allRisks: 'Todos los Riesgos',
        allTypes: 'Todos los Tipos'
      }
    },
    history: {
      title: 'Historial de Alertas',
      search: 'Buscar mensajes...',
      table: {
        message: 'Mensaje',
        prediction: 'Predicción',
        risk: 'Riesgo',
        confidence: 'Confianza',
        date: 'Fecha',
        user: 'Usuario'
      },
      pagination: 'Mostrando {count} de {total} resultados',
      page: 'Página {current} de {total}'
    },
    settings: {
      title: 'Ajustes de Cuenta',
      profile: 'Información del Perfil',
      name: 'Nombre Completo',
      email: 'Correo Electrónico',
      update: 'Actualizar Perfil',
      security: 'Seguridad',
      currentPass: 'Contraseña Actual',
      newPass: 'Nueva Contraseña',
      confirmPass: 'Confirmar Nueva Contraseña',
      changePass: 'Cambiar Contraseña',
      notifications: 'Notificaciones',
      emailAlerts: 'Alertas por Email',
      emailAlertsDesc: 'Recibe alertas de alto riesgo por correo electrónico',
      webhookAlerts: 'Alertas Webhook',
      webhookAlertsDesc: 'Activa webhooks de seguridad para detecciones de alto riesgo',
      danger: 'Zona de Peligro',
      deleteDesc: 'Una vez que elimines tu cuenta, no hay vuelta atrás. Por favor, asegúrate.',
      deleteBtn: 'Eliminar Cuenta',
      deleteConfirm: '¿Estás absolutamente seguro?',
      deleteYes: 'Sí, Eliminar mi Cuenta',
      cancel: 'Cancelar',
      language: 'Selección de Idioma',
      profileSuccess: '¡Perfil actualizado con éxito!',
      passSuccess: '¡Contraseña cambiada con éxito!',
      passMismatch: 'Las nuevas contraseñas no coinciden',
      updateError: 'Error al actualizar el perfil',
      passError: 'Error al cambiar la contraseña',
      deleteError: 'Error al eliminar la cuenta'
    },
    complaints: {
      title: 'Reportar Patrón Sospechoso',
      subtitle: 'Ayúdanos a mejorar la detección reportando nuevas tácticas de estafa que hayas encontrado.',
      submitTitle: 'Enviar Nuevo Reporte',
      placeholder: 'Describe el patrón de estafa o pega el mensaje...',
      submitBtn: 'Enviar Reporte',
      success: '¡Reporte enviado con éxito!',
      historyTitle: 'Mi Historial de Reportes',
      adminTitle: 'Todos los Reportes (Moderación)',
      noReports: 'No se encontraron reportes.',
      moderate: 'Moderar',
      status: 'Estado',
      notes: 'Notas del Revisor',
      notesPlaceholder: 'Añadir notas para el usuario...',
      save: 'Guardar Cambios',
      pending: 'Pendiente',
      inReview: 'En Revisión',
      resolved: 'Resuelto',
      rejected: 'Rechazado'
    },
    notifications: {
      title: 'Registros de Alertas de Alto Riesgo',
      table: {
        id: 'ID de Detección',
        channel: 'Canal',
        recipient: 'Destinatario',
        status: 'Estado',
        date: 'Fecha y Hora'
      },
      noLogs: 'No se encontraron registros de notificación.'
    },
    auth: {
      unverified: 'Email no verificado',
      requestVerification: 'Solicitar verificación'
    }
  }
};
