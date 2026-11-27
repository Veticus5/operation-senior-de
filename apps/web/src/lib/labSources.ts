import executionLab from '../../../../labs/execution_architecture/execution_lab.py?raw';
import lazyLab from '../../../../labs/lazy_evaluation/lazy_lab.py?raw';
import joinLab from '../../../../labs/join_strategies/join_strategies_lab.py?raw';

/**
 * Kod labów pokazywany w interfejsie, wkompilowany w aplikację, żeby był widoczny także bez runnera.
 * Klucz to id z labs/registry.json. Test sprawdza, że każdy lab z rejestru ma tu swój wpis.
 * Czy to ten sam plik, który uruchomi runner, sprawdza LabRunner: porównuje skrót SHA-256.
 */
export const LAB_SOURCES: Record<string, string> = {
  'spark-lazy-evaluation-lab': lazyLab,
  'spark-execution-architecture-lab': executionLab,
  'spark-join-strategies-lab': joinLab
};
