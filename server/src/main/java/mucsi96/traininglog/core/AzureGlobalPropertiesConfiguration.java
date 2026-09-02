package mucsi96.traininglog.core;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import com.azure.spring.cloud.autoconfigure.implementation.context.properties.AzureGlobalProperties;

/**
 * Spring Cloud Azure registers its {@code springCloudAzureGlobalProperties} bean
 * from an {@code ImportBeanDefinitionRegistrar} that binds the properties in a
 * lambda instance supplier, which ahead-of-time processing cannot turn into
 * generated code. The library does not leave that to fail on its own: it ships
 * an {@code AzureGlobalPropertiesBeanRegistrationExcludeFilter} that drops the
 * bean from AOT processing by name, unconditionally as of 7.3.0. So the bean is
 * simply absent from an AOT-processed application, which then fails to start
 * with "required a bean of type AzureGlobalProperties that could not be found".
 * Declaring one is the response the library leaves open, not a workaround
 * against it - do not expect a Spring or Azure release to make it unnecessary.
 *
 * This declares the same properties as a plain configuration-properties bean,
 * which AOT can generate, under its own name. The name is the part that has to
 * be different: the registrar registers its bean only if nothing has claimed
 * {@code springCloudAzureGlobalProperties} yet, so taking that name would mean
 * racing it for no gain. The prefix is the one the registrar binds, and through
 * the same {@code Binder}, so a plain JVM run binds exactly what it did before.
 * Everything injects {@link AzureGlobalProperties} by type, so with AOT this is
 * the only candidate, and without it {@link Primary} picks it over the
 * registrar's.
 */
@Configuration(proxyBeanMethods = false)
public class AzureGlobalPropertiesConfiguration {

  @Bean
  @Primary
  @ConfigurationProperties(prefix = AzureGlobalProperties.PREFIX)
  AzureGlobalProperties appSpringCloudAzureGlobalProperties() {
    return new AzureGlobalProperties();
  }
}
