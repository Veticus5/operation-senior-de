import lazyLab from '../../../../labs/lazy_evaluation/lazy_lab.py?raw';
import skewAqeLab from '../../../../labs/data_skew/skew_aqe_lab.py?raw';

/**
 * Kod labów pokazywany w interfejsie, wkompilowany w aplikację, żeby był widoczny także bez runnera.
 * Klucz to id z labs/registry.json. Test sprawdza, że każdy lab z rejestru ma tu swój wpis.
 * Czy to ten sam plik, który uruchomi runner, sprawdza LabRunner: porównuje skrót SHA-256.
 */
export const LAB_SOURCES: Record<string, string> = {
  'spark-lazy-evaluation-lab': lazyLab,
  'spark-data-skew-aqe-lab': skewAqeLab
};
