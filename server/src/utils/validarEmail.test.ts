import { describe, it, expect } from 'vitest';
import {
	esDominioClientePermitido,
	esDominioPermitido,
	esEmailClienteValido,
	esEmailValido,
} from './validarEmail.js';

describe('validarEmail', () => {
	describe('esDominioPermitido', () => {
		it('acepta dominios conocidos de proveedores principales', () => {
			expect(esDominioPermitido('usuario@gmail.com')).toBe(true);
			expect(esDominioPermitido('usuario@hotmail.com')).toBe(true);
			expect(esDominioPermitido('usuario@outlook.com')).toBe(true);
			expect(esDominioPermitido('usuario@yahoo.com')).toBe(true);
			expect(esDominioPermitido('usuario@hotmail.com.mx')).toBe(true);
			expect(esDominioPermitido('usuario@outlook.es')).toBe(true);
			expect(esDominioPermitido('usuario@yahoo.com.co')).toBe(true);
		});

		it('rechaza dominios desconocidos o temporales', () => {
			expect(esDominioPermitido('usuario@mailinator.com')).toBe(false);
			expect(esDominioPermitido('usuario@tempmail.com')).toBe(false);
			expect(esDominioPermitido('usuario@guerrillamail.com')).toBe(false);
			expect(esDominioPermitido('usuario@empresa.com')).toBe(false);
			expect(esDominioPermitido('usuario@universidad.edu.mx')).toBe(false);
			expect(esDominioPermitido('usuario@icloud.com')).toBe(false);
			expect(esDominioPermitido('usuario@protonmail.com')).toBe(false);
		});
	});

	describe('esEmailValido', () => {
		it('acepta emails con formato correcto y dominio permitido', () => {
			expect(esEmailValido('miguel@gmail.com')).toBe(true);
			expect(esEmailValido('ana.lopez@outlook.com')).toBe(true);
			expect(esEmailValido('cliente123@hotmail.es')).toBe(true);
		});

		it('rechaza emails con dominio no permitido aunque el formato sea válido', () => {
			expect(esEmailValido('miguel@empresa.com')).toBe(false);
			expect(esEmailValido('test@mailinator.com')).toBe(false);
		});

		it('rechaza emails con formato inválido', () => {
			expect(esEmailValido('sin-arroba')).toBe(false);
			expect(esEmailValido('@gmail.com')).toBe(false);
			expect(esEmailValido('usuario@ gmail.com')).toBe(false);
			expect(esEmailValido('usuario@')).toBe(false);
			expect(esEmailValido('')).toBe(false);
		});
	});

	describe('esEmailClienteValido', () => {
		it('acepta solo los dominios permitidos para alta de cliente', () => {
			expect(esDominioClientePermitido('usuario@gmail.com')).toBe(true);
			expect(esDominioClientePermitido('usuario@icloud.com')).toBe(true);
			expect(esEmailClienteValido('cliente@outlook.com')).toBe(true);
		});

		it('rechaza variantes fuera del alcance de alta de cliente', () => {
			expect(esDominioClientePermitido('usuario@hotmail.es')).toBe(false);
			expect(esEmailClienteValido('cliente@yahoo.com.co')).toBe(false);
			expect(esEmailClienteValido('cliente@empresa.com')).toBe(false);
		});
	});
});
