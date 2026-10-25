import { etatAbonnement } from './libelles';

// La règle d'affichage d'un abonnement : le statut seul ne suffit pas, la date
// de fin passée (actif = false, calculé par le backend) change ce qu'on montre.
describe('etatAbonnement', () => {
  it('montre un essai en cours comme un essai', () => {
    expect(etatAbonnement({ statut: 'ESSAI', actif: true })).toBe('ESSAI');
  });

  it('distingue un essai termine d un abonnement expire', () => {
    expect(etatAbonnement({ statut: 'ESSAI', actif: false })).toBe('ESSAI_TERMINE');
    expect(etatAbonnement({ statut: 'ACTIF', actif: false })).toBe('EXPIRE');
  });

  it('garde les decisions de la plateforme telles quelles', () => {
    expect(etatAbonnement({ statut: 'ACTIF', actif: true })).toBe('ACTIF');
    expect(etatAbonnement({ statut: 'SUSPENDU', actif: false })).toBe('SUSPENDU');
    expect(etatAbonnement({ statut: 'RESILIE', actif: false })).toBe('RESILIE');
  });
});
