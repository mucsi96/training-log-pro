use sea_orm_migration::prelude::*;

pub struct Migrator;

mod m20261107_000001_baseline;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![Box::new(m20261107_000001_baseline::Migration)]
    }
}
