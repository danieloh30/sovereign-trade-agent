package org.acme.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "aml_rules")
public class AmlRule extends PanacheEntity {

    public String currency;
    public Double thresholdAmount;
    public String action;
    public String description;

    /**
     * Find AML rule by currency and amount
     */
    public static AmlRule findByCurrencyAndAmount(String currency, double amount) {
        return find("currency = ?1 and thresholdAmount <= ?2 order by thresholdAmount desc",
                    currency, amount)
                .firstResult();
    }
}
