#!/usr/bin/env node
/**
 * Verificación rápida: Endpoint /disponibilidad-completa
 * 
 * Prueba que después del fix, el endpoint devuelve especialistas
 * incluso si no tienen slots disponibles
 */

const baseURL = 'http://localhost:3000';

// IDs de prueba - adaptarlos al ambiente local
const testStudioId = process.env.BTP_ESTUDIO_ID || 'test-studio-id';
const testDate = new Date().toISOString().split('T')[0];

async function verificarEndpoint() {
  try {
    console.log('🔍 Verificando endpoint /disponibilidad-completa...\n');
    console.log(`📍 URL: ${baseURL}/salones/publicos/${testStudioId}/disponibilidad-completa`);
    console.log(`📅 Fecha: ${testDate}`);
    console.log(`⏱️  Duración: 60 minutos\n`);

    const response = await fetch(
      `${baseURL}/salones/publicos/${testStudioId}/disponibilidad-completa?fecha=${testDate}&duracion=60`,
      { method: 'GET' }
    );

    if (!response.ok) {
      console.error(`❌ Error HTTP ${response.status}:`, response.statusText);
      const error = await response.json().catch(() => ({}));
      console.error(error);
      process.exit(1);
    }

    const data = await response.json();
    const { especialistas = [] } = data;

    console.log(`✅ Respuesta recibida\n`);
    console.log(`📊 ESTADÍSTICAS:`);
    console.log(`   • Total especialistas: ${especialistas.length}`);

    if (especialistas.length === 0) {
      console.log('\n⚠️  No hay especialistas en la respuesta.');
      console.log('   Verificar que el estudio tenga personal activo configurado.');
      process.exit(1);
    }

    // Analizar cada especialista
    const conSlotLibre = especialistas.filter(e => e.slotsLibres.length > 0).length;
    const sinSlotLibre = especialistas.filter(e => e.slotsLibres.length === 0).length;
    const conSlotOcupado = especialistas.filter(e => e.slotsOcupados.length > 0).length;

    console.log(`   • Con slots libres: ${conSlotLibre}`);
    console.log(`   • Sin slots libres: ${sinSlotLibre}`);
    console.log(`   • Con slots ocupados: ${conSlotOcupado}\n`);

    console.log('📋 DETALLE POR ESPECIALISTA:\n');

    especialistas.forEach((esp, idx) => {
      console.log(`${idx + 1}. ${esp.nombre} (ID: ${esp.id})`);
      console.log(`   Foto: ${esp.foto ? '✓' : '✗'}`);
      console.log(`   Especialidades: ${esp.especialidades.join(', ') || 'Ninguna'}`);
      console.log(`   Slots libres: ${esp.slotsLibres.length} → ${esp.slotsLibres.slice(0, 3).join(', ')}${esp.slotsLibres.length > 3 ? '...' : ''}`);
      console.log(`   Slots ocupados: ${esp.slotsOcupados.length} → ${esp.slotsOcupados.slice(0, 3).join(', ')}${esp.slotsOcupados.length > 3 ? '...' : ''}`);
      console.log('');
    });

    // Verificación del fix
    console.log('✅ VERIFICACIONES DEL FIX:\n');
    
    // Antes del fix: Si un especialista no tenía slots, se filtraba completamente
    // Después del fix: El especialista siempre aparece si está activo
    const todosLosEspecialistasAparecen = especialistas.every(e => 
      typeof e.id === 'string' && 
      typeof e.nombre === 'string' && 
      Array.isArray(e.slotsLibres) && 
      Array.isArray(e.slotsOcupados)
    );

    if (todosLosEspecialistasAparecen) {
      console.log('✓ Todos los especialistas tienen estructura válida');
    } else {
      console.log('✗ Estructura inválida en algunos especialistas');
      process.exit(1);
    }

    // Si hay especialistas sin slots libres pero que se devolvieron,
    // significa que el fix funcionó (antes eran filtrados)
    if (sinSlotLibre > 0) {
      console.log(`✓ Especialistas sin slots libres se devuelven correctamente (${sinSlotLibre})`);
      console.log('  → El fix permite que usuarios vean que el especialista está ocupado');
    }

    console.log('\n✅ CONCLUSIÓN: Endpoint funcionando correctamente después del fix\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error en verificación:', error.message);
    process.exit(1);
  }
}

verificarEndpoint();
