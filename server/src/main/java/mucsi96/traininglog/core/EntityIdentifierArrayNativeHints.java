package mucsi96.traininglog.core;

import java.lang.reflect.Field;
import java.util.Objects;
import java.util.stream.Stream;

import org.springframework.aot.hint.MemberCategory;
import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.RuntimeHintsRegistrar;
import org.springframework.aot.hint.TypeReference;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.ImportRuntimeHints;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.util.ClassUtils;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;

/**
 * Array types for the identifiers of the JPA entities.
 *
 * Hibernate builds a multi-id loader for every entity while the session factory
 * starts, and that loader allocates an array of the identifier type through
 * {@code Array.newInstance}. Instantiating an array reflectively is registered
 * separately from the component type in a native image, and the framework's AOT
 * processing registers the entities themselves but not these arrays, so the
 * image dies before the context is up with
 *
 * <pre>
 * MissingReflectionRegistrationError: Cannot reflectively instantiate the
 *     array class 'java.time.ZonedDateTime[]'
 * </pre>
 *
 * naming only the type, not the entity behind it. Every identifier type needs
 * one, and the failure comes one type at a time, so they are read off the
 * entities rather than listed: adding an entity with a new identifier type
 * needs no change here.
 *
 * Only the native image needs this. The AOT-on-JVM run described in AGENTS.md
 * cannot show the failure - reflection always works there.
 */
@Configuration(proxyBeanMethods = false)
@ImportRuntimeHints(EntityIdentifierArrayNativeHints.Registrar.class)
public class EntityIdentifierArrayNativeHints {

  static class Registrar implements RuntimeHintsRegistrar {

    private static final String ENTITY_PACKAGE = "mucsi96.traininglog";

    @Override
    public void registerHints(RuntimeHints hints, ClassLoader classLoader) {
      final ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(
          false);
      scanner.addIncludeFilter(new AnnotationTypeFilter(Entity.class));

      scanner.findCandidateComponents(ENTITY_PACKAGE).stream()
          .map(BeanDefinition::getBeanClassName)
          .map(name -> ClassUtils.resolveClassName(name, classLoader))
          .flatMap(Registrar::identifierFields)
          .map(Field::getType)
          .distinct()
          .forEach(idType -> hints.reflection().registerType(TypeReference.of(idType.arrayType()),
              MemberCategory.INVOKE_DECLARED_CONSTRUCTORS));
    }

    /** The identifier fields of an entity, including any mapped superclass. */
    private static Stream<Field> identifierFields(Class<?> entity) {
      return Stream.<Class<?>>iterate(entity, Objects::nonNull, Class::getSuperclass)
          .flatMap(type -> Stream.of(type.getDeclaredFields()))
          .filter(field -> field.isAnnotationPresent(Id.class)
              || field.isAnnotationPresent(EmbeddedId.class));
    }
  }
}
