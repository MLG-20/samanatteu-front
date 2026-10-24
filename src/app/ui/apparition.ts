import { Directive, ElementRef, OnDestroy, afterNextRender, inject } from '@angular/core';

/**
 * Une DIRECTIVE ajoute un comportement à une balise existante (≈ une annotation
 * qui « décore » un élément, sans créer de nouveau composant).
 *
 *   <section appApparition> … </section>
 *
 * L'élément reçoit la classe `visible` dès qu'il entre à l'écran pendant le
 * défilement ; le CSS s'occupe de l'animation (fondu + montée).
 * IntersectionObserver = l'API du navigateur qui prévient quand un élément
 * devient visible (bien plus léger que d'écouter chaque scroll).
 */
@Directive({ selector: '[appApparition]', host: { class: 'apparition' } })
export class Apparition implements OnDestroy {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private observateur?: IntersectionObserver;

  constructor() {
    // afterNextRender : seulement dans le navigateur, une fois l'élément affiché.
    afterNextRender(() => {
      // Navigateur trop ancien ou tests (jsdom) : on affiche tout de suite.
      if (typeof IntersectionObserver === 'undefined') {
        this.element.classList.add('visible');
        return;
      }
      this.observateur = new IntersectionObserver(
        (entrees) => {
          if (entrees.some((e) => e.isIntersecting)) {
            this.element.classList.add('visible');
            this.observateur?.disconnect(); // une seule fois : on ne rejoue pas l'animation
          }
        },
        { threshold: 0.15 },
      );
      this.observateur.observe(this.element);
    });
  }

  ngOnDestroy(): void {
    this.observateur?.disconnect();
  }
}
