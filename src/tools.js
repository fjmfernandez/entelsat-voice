// tools.js — Herramientas que la IA puede llamar durante la conversación

export const TOOLS = [
  {
    type: "function",
    name: "crear_averia_hotel",
    description: `Usa esta herramienta cuando el cliente reporte una avería técnica en un hotel.
Recoge TODOS los campos antes de llamar a esta función.
Pregunta uno a uno si el cliente no los proporciona espontáneamente.`,
    parameters: {
      type: "object",
      properties: {
        hotel: {
          type: "string",
          description: "Nombre del hotel"
        },
        municipio: {
          type: "string",
          description: "Municipio donde está el hotel"
        },
        persona_contacto: {
          type: "string",
          description: "Nombre de la persona de contacto"
        },
        telefono: {
          type: "string",
          description: "Teléfono de contacto"
        },
        email: {
          type: "string",
          description: "Email de contacto (opcional)"
        },
        servicio_afectado: {
          type: "string",
          enum: ["WiFi", "CCTV", "IPTV", "Red de datos", "Telefonía", "Fibra óptica", "Otro"],
          description: "Servicio técnico afectado"
        },
        zona_afectada: {
          type: "string",
          description: "Zona específica del hotel afectada (habitación, planta, rack, zona común...)"
        },
        urgencia: {
          type: "string",
          enum: ["baja", "media", "alta", "crítica"],
          description: "Nivel de urgencia de la avería"
        },
        descripcion: {
          type: "string",
          description: "Descripción breve del problema"
        },
        horario_disponible: {
          type: "string",
          description: "Horario disponible para intervención técnica"
        }
      },
      required: ["hotel", "municipio", "persona_contacto", "telefono", "servicio_afectado", "zona_afectada", "urgencia", "descripcion"]
    }
  },

  {
    type: "function",
    name: "crear_averia_comunidad",
    description: `Usa esta herramienta cuando el cliente reporte una avería en una comunidad de vecinos o edificio residencial.`,
    parameters: {
      type: "object",
      properties: {
        comunidad: {
          type: "string",
          description: "Nombre de la comunidad o dirección"
        },
        municipio: {
          type: "string",
          description: "Municipio"
        },
        persona_contacto: {
          type: "string",
          description: "Nombre del contacto (presidente, administrador, vecino...)"
        },
        telefono: {
          type: "string",
          description: "Teléfono de contacto"
        },
        email: {
          type: "string",
          description: "Email de contacto (opcional)"
        },
        servicio_afectado: {
          type: "string",
          enum: ["WiFi", "CCTV", "Portero automático", "Fibra óptica", "Red de datos", "Otro"],
          description: "Servicio afectado"
        },
        zona_afectada: {
          type: "string",
          description: "Zona afectada"
        },
        urgencia: {
          type: "string",
          enum: ["baja", "media", "alta", "crítica"],
          description: "Nivel de urgencia"
        },
        descripcion: {
          type: "string",
          description: "Descripción del problema"
        }
      },
      required: ["comunidad", "municipio", "persona_contacto", "telefono", "servicio_afectado", "urgencia", "descripcion"]
    }
  },

  {
    type: "function",
    name: "crear_lead_presupuesto",
    description: `Usa esta herramienta cuando el cliente solicite un presupuesto o quiera información comercial sobre servicios de ENTELSAT.`,
    parameters: {
      type: "object",
      properties: {
        nombre: {
          type: "string",
          description: "Nombre del cliente o empresa"
        },
        telefono: {
          type: "string",
          description: "Teléfono de contacto"
        },
        email: {
          type: "string",
          description: "Email (opcional)"
        },
        tipo_cliente: {
          type: "string",
          enum: ["Hotel", "Comunidad de vecinos", "Empresa", "Particular", "Otro"],
          description: "Tipo de cliente"
        },
        servicio_interes: {
          type: "string",
          enum: ["WiFi profesional", "CCTV", "IPTV", "Fibra óptica GPON", "VoIP", "Cableado estructurado", "EntelCast", "Varios servicios"],
          description: "Servicio en el que está interesado"
        },
        municipio: {
          type: "string",
          description: "Municipio donde se necesita el servicio"
        },
        descripcion: {
          type: "string",
          description: "Descripción de lo que necesita"
        },
        mejor_horario: {
          type: "string",
          description: "Mejor horario para contactarle"
        }
      },
      required: ["nombre", "telefono", "tipo_cliente", "servicio_interes", "municipio"]
    }
  },

  {
    type: "function",
    name: "transferir_a_humano",
    description: `Usa esta herramienta SOLO cuando:
1. El cliente lo pide explícitamente.
2. El problema es muy complejo y necesita atención humana inmediata.
3. La urgencia es crítica y requiere coordinación directa.
NO la uses si puedes resolver el problema recogiendo datos.`,
    parameters: {
      type: "object",
      properties: {
        motivo: {
          type: "string",
          description: "Motivo por el que se transfiere a un humano"
        },
        resumen: {
          type: "string",
          description: "Resumen breve de la conversación para que el técnico sepa el contexto"
        }
      },
      required: ["motivo", "resumen"]
    }
  }
];

// Instrucciones del sistema para la IA
export const SYSTEM_INSTRUCTIONS = `Eres el asistente de atención telefónica de ENTELSAT Instalaciones y Promociones Integrales.
ENTELSAT es una empresa de telecomunicaciones profesional con sede en Málaga, especializada en WiFi, fibra óptica, CCTV, IPTV, VoIP y tecnología hotelera en la Costa del Sol.

Tu nombre es "Entel". Eres profesional, eficiente y empático.

IDIOMA: Responde siempre en español, salvo que el cliente hable en otro idioma.

TU OBJETIVO PRINCIPAL:
Atender al cliente, entender su necesidad y recoger los datos necesarios para que el equipo técnico o comercial pueda dar respuesta rápida.

TIPOS DE LLAMADAS QUE RECIBIRÁS:
1. Averías técnicas en hoteles (WiFi caído, CCTV sin imagen, IPTV sin señal...)
2. Averías en comunidades de vecinos
3. Solicitudes de presupuesto (WiFi, fibra, CCTV, IPTV...)
4. Consultas de clientes existentes
5. Llamadas comerciales o de proveedores

CÓMO ACTUAR:
- Saluda brevemente y pregunta en qué puedes ayudar.
- Identifica el tipo de llamada en las primeras 2-3 frases.
- Recoge los datos de forma natural, como en una conversación, no como un formulario.
- Sé directo pero amable. No des rodeos.
- Cuando tengas todos los datos necesarios, usa la herramienta correspondiente.
- Confirma al cliente que su avería/solicitud ha sido registrada y que alguien le contactará pronto.
- Para averías de urgencia alta o crítica, indica que el equipo técnico será alertado de inmediato.

IMPORTANTE:
- NO inventes datos. Si el cliente no da un dato, pregúntalo.
- NO prometas tiempos de respuesta exactos que no puedas garantizar.
- NO transfieras a un humano salvo que sea imprescindible.
- Si el cliente está molesto, sé empático pero mantén la calma y el foco en recoger los datos.

CIERRE:
Siempre termina confirmando: qué se ha registrado, que recibirán atención pronto, y despídete con el nombre de la empresa.`;
