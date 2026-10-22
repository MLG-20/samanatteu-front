import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardMembre } from './dashboard-membre';

describe('DashboardMembre', () => {
  let component: DashboardMembre;
  let fixture: ComponentFixture<DashboardMembre>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardMembre],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardMembre);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
