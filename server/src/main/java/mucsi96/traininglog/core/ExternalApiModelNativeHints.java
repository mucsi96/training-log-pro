package mucsi96.traininglog.core;

import org.springframework.aot.hint.BindingReflectionHintsRegistrar;
import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.RuntimeHintsRegistrar;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.ImportRuntimeHints;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.util.ClassUtils;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;

/**
 * Binding metadata for the Withings and Strava response models the OpenAPI
 * generator produces from {@code withings.yml} and {@code strava.yml}.
 *
 * The framework's own AOT processing covers the models of {@code api.yml},
 * because those are controller parameter and return types and it walks the
 * handler methods. Nothing walks the other direction: these models are read
 * back from the external APIs through a {@code RestTemplate}, and the Withings
 * access-token response through a plain {@code ObjectMapper}, neither of which
 * leaves a trace AOT processing can follow. Without hints Jackson finds no
 * accessors in the native image and every field of every response comes back
 * {@code null}, so the first failure is a {@link NullPointerException} in the
 * mapping code rather than anything naming reflection.
 *
 * The scan registers whatever the generator currently emits rather than a list
 * of the response types used today: adding an endpoint to one of the specs
 * would otherwise reintroduce this, and it fails only against the real Withings
 * or Strava API, which no test drives. {@code JsonPropertyOrder} is what marks
 * a generated model - the hand-written controllers, services and exceptions
 * sharing these packages do not carry it. Nested enums such as
 * {@code StravaSummaryActivity.SportTypeEnum} need no filter of their own;
 * {@link BindingReflectionHintsRegistrar} follows property types.
 *
 * Only the native image needs this. The AOT-on-JVM run described in AGENTS.md
 * cannot show the failure - reflection always works there.
 */
@Configuration(proxyBeanMethods = false)
@ImportRuntimeHints(ExternalApiModelNativeHints.Registrar.class)
public class ExternalApiModelNativeHints {

  static class Registrar implements RuntimeHintsRegistrar {

    private static final String[] PACKAGES = {
        "mucsi96.traininglog.withings",
        "mucsi96.traininglog.strava"
    };

    @Override
    public void registerHints(RuntimeHints hints, ClassLoader classLoader) {
      final ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(
          false);
      scanner.addIncludeFilter(new AnnotationTypeFilter(JsonPropertyOrder.class));
      final BindingReflectionHintsRegistrar registrar = new BindingReflectionHintsRegistrar();

      for (String pkg : PACKAGES) {
        for (BeanDefinition definition : scanner.findCandidateComponents(pkg)) {
          registrar.registerReflectionHints(hints.reflection(),
              ClassUtils.resolveClassName(definition.getBeanClassName(), classLoader));
        }
      }
    }
  }
}
