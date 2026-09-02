package mucsi96.traininglog.core;

import org.springframework.aot.hint.MemberCategory;
import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.RuntimeHintsRegistrar;
import org.springframework.beans.factory.annotation.AnnotatedBeanDefinition;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.ImportRuntimeHints;

/**
 * Reachability metadata for the Liquibase change model.
 *
 * Liquibase turns a changelog into objects by introspecting the change class
 * and calling the setter named after each attribute, so the reflection a
 * changelog needs is decided by the changelog, not by the code. The community
 * metadata that {@code metadataRepository} pulls in was collected from some
 * other project's changelog: it registers {@code AbstractSQLChange.setSql} but
 * not {@code setDbms}, which is what {@code db.changelog-master.yaml} uses to
 * keep two raw SQL changesets on PostgreSQL. Without this the native image
 * fails at startup with
 *
 * <pre>
 * MissingReflectionRegistrationError: Cannot reflectively invoke method
 *     'public void liquibase.change.AbstractSQLChange.setDbms(String)'
 * </pre>
 *
 * while the changelog is being parsed - before a single changeset runs, so the
 * database is untouched and the message names the attribute rather than the
 * changeset.
 *
 * The whole {@code liquibase.change} package is registered rather than the
 * setter missing today, because the next attribute added to the changelog would
 * fail exactly the same way. The scan is deliberately indiscriminate - it keeps
 * abstract types, where the setters live far more often than on the concrete
 * change, and does not bother to exclude interfaces or annotations either.
 * Narrowing it to concrete classes is what would reintroduce the bug.
 *
 * Only the native image needs this. The AOT-on-JVM run described in AGENTS.md
 * cannot show the failure - reflection always works there.
 */
@Configuration(proxyBeanMethods = false)
@ImportRuntimeHints(LiquibaseChangeNativeHints.Registrar.class)
public class LiquibaseChangeNativeHints {

  static class Registrar implements RuntimeHintsRegistrar {

    private static final String CHANGE_PACKAGE = "liquibase.change";

    private static final String PACKAGE_INFO = "package-info";

    @Override
    public void registerHints(RuntimeHints hints, ClassLoader classLoader) {
      final ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(
          false) {
        @Override
        protected boolean isCandidateComponent(AnnotatedBeanDefinition beanDefinition) {
          // The default rejects abstract types, which is where the setters are.
          return true;
        }
      };
      // Everything in the package, minus the package-info pseudo-classes the
      // scanner also reports and which are not class names at all.
      scanner.addIncludeFilter((metadataReader, metadataReaderFactory) -> !metadataReader
          .getClassMetadata().getClassName().endsWith(PACKAGE_INFO));

      for (BeanDefinition definition : scanner.findCandidateComponents(CHANGE_PACKAGE)) {
        hints.reflection().registerTypeIfPresent(classLoader, definition.getBeanClassName(),
            MemberCategory.INVOKE_DECLARED_CONSTRUCTORS, MemberCategory.INVOKE_PUBLIC_METHODS);
      }
    }
  }
}
