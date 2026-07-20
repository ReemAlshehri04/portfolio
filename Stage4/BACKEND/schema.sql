-- ============================================================
-- ENUM TYPES
-- ============================================================
CREATE TYPE user_type_enum AS ENUM (
    'client',
    'restaurant',
    'admin'
);

CREATE TYPE gender_enum AS ENUM (
    'male',
    'female'
);

CREATE TYPE health_goal_enum AS ENUM (
    'lose_weight',
    'maintain',
    'bulking',
    'gaining_weight'
);

CREATE TYPE subscription_status_enum AS ENUM (
    'confirmed',
    'cancelled'
);

CREATE TYPE day_of_week_enum AS ENUM (
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday'
);

CREATE TYPE order_item_status_enum AS ENUM (
    'confirmed',
    'cancelled'
);

CREATE TYPE payment_status_enum AS ENUM (
    'pending',
    'success',
    'failed'
);

-- ============================================================
-- discount_code
-- ============================================================
CREATE TABLE discount_code (
    discount_code_id    SERIAL          NOT NULL,
    code                VARCHAR(50)     NOT NULL,
    discount_percentage DECIMAL(5,2)    NOT NULL,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    expires_at          TIMESTAMP                DEFAULT NULL,
    created_at          TIMESTAMP       NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_discount_code PRIMARY KEY (discount_code_id),
    CONSTRAINT uq_discount_code_code UNIQUE (code),
    CONSTRAINT chk_discount_percentage
        CHECK (discount_percentage > 0 AND discount_percentage <= 100)
);

-- ============================================================
-- app_user
-- ============================================================
CREATE TABLE app_user (
    user_id         SERIAL                  NOT NULL,
    user_type       user_type_enum          NOT NULL,
    full_name       VARCHAR(100)            NOT NULL,
    email           VARCHAR(150)            NOT NULL,
    password_hash   VARCHAR(255)            NOT NULL,
    phone           VARCHAR(15)             NOT NULL,
    created_at      TIMESTAMP               NOT NULL DEFAULT NOW(),
    is_active       BOOLEAN                 NOT NULL DEFAULT TRUE,

    -- Health profile (client only — NULL for restaurant and admin)
    age             INT                     DEFAULT NULL,
    gender          gender_enum             DEFAULT NULL,
    height_cm       DECIMAL(5,2)            DEFAULT NULL,
    weight_kg       DECIMAL(5,2)            DEFAULT NULL,
    health_goal     health_goal_enum        DEFAULT NULL,

    -- Address (client only — NULL for restaurant and admin)
    address         VARCHAR(255)            DEFAULT NULL,

    CONSTRAINT pk_app_user PRIMARY KEY (user_id),
    CONSTRAINT uq_app_user_email UNIQUE (email),

    -- Only qooti-admin.com domain allowed for admin accounts.
    CONSTRAINT chk_admin_email_domain
        CHECK (
            user_type <> 'admin'
            OR LOWER(email) LIKE '%@qooti-admin.com'
        )
);

-- ============================================================
-- restaurant
-- ============================================================
CREATE TABLE restaurant (
    restaurant_id       SERIAL          NOT NULL,
    user_id             INT             NOT NULL,
    restaurant_name     VARCHAR(150)    NOT NULL,
    description         TEXT            DEFAULT NULL,
    logo_url            VARCHAR(255)    DEFAULT NULL,
    is_verified         BOOLEAN         NOT NULL DEFAULT FALSE,
    rejection_reason    VARCHAR(255)    DEFAULT NULL,
    created_at          TIMESTAMP       NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_restaurant PRIMARY KEY (restaurant_id),
    CONSTRAINT uq_restaurant_user UNIQUE (user_id),
    CONSTRAINT fk_restaurant_user
        FOREIGN KEY (user_id)
        REFERENCES app_user (user_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

-- ============================================================
-- meal
-- Depends on: restaurant
-- ============================================================
CREATE TABLE meal (
    meal_id         SERIAL          NOT NULL,
    restaurant_id   INT             NOT NULL,
    name            VARCHAR(150)    NOT NULL,
    description     TEXT            DEFAULT NULL,
    ingredients     TEXT            NOT NULL,
    calories        INT             NOT NULL,
    protein_g       DECIMAL(5,2)    NOT NULL,
    carbs_g         DECIMAL(5,2)    NOT NULL,
    fats_g          DECIMAL(5,2)    NOT NULL,
    image_url       VARCHAR(255)    DEFAULT NULL,
    tags            TEXT[]          DEFAULT NULL,
    is_available    BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_meal PRIMARY KEY (meal_id),
    CONSTRAINT fk_meal_restaurant
        FOREIGN KEY (restaurant_id)
        REFERENCES restaurant (restaurant_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

-- ============================================================
-- subscription
-- Depends on: app_user, discount_code
-- ============================================================
CREATE TABLE subscription (
    subscription_id     SERIAL                      NOT NULL,
    user_id             INT                         NOT NULL,
    discount_code_id    INT                         DEFAULT NULL,
    start_date          DATE                        NOT NULL,
    end_date            DATE                        NOT NULL,
    delivery_time       TIME                        NOT NULL,
    original_price      DECIMAL(7,2)                NOT NULL,
    discount_amount     DECIMAL(7,2)                NOT NULL DEFAULT 0.00,
    final_price         DECIMAL(7,2)                NOT NULL,
    status              subscription_status_enum    NOT NULL DEFAULT 'confirmed',
    is_renewed          BOOLEAN                     NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMP                   NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_subscription PRIMARY KEY (subscription_id),
    CONSTRAINT chk_final_price
        CHECK (final_price = original_price - discount_amount),
    CONSTRAINT fk_subscription_user
        FOREIGN KEY (user_id)
        REFERENCES app_user (user_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_subscription_discount
        FOREIGN KEY (discount_code_id)
        REFERENCES discount_code (discount_code_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

-- ============================================================
-- order_item
-- Depends on: subscription, meal
-- ============================================================
CREATE TABLE order_item (
    order_item_id   SERIAL                      NOT NULL,
    subscription_id INT                         NOT NULL,
    meal_id         INT                         NOT NULL,
    day_date        DATE                        NOT NULL,
    day_of_week     day_of_week_enum            NOT NULL,
    status          order_item_status_enum      NOT NULL DEFAULT 'confirmed',
    created_at      TIMESTAMP                   NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_order_item PRIMARY KEY (order_item_id),
    CONSTRAINT uq_order_item_day UNIQUE (subscription_id, day_date),
    CONSTRAINT fk_order_item_subscription
        FOREIGN KEY (subscription_id)
        REFERENCES subscription (subscription_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_order_item_meal
        FOREIGN KEY (meal_id)
        REFERENCES meal (meal_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

-- ============================================================
-- payment
-- Depends on: subscription
-- ============================================================
CREATE TABLE payment (
    payment_id          SERIAL                  NOT NULL,
    subscription_id     INT                     NOT NULL,
    amount              DECIMAL(7,2)            NOT NULL,
    payment_status      payment_status_enum     NOT NULL DEFAULT 'pending',
    transaction_id      VARCHAR(100)            DEFAULT NULL,
    gateway_response    TEXT                    DEFAULT NULL,
    created_at          TIMESTAMP               NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_payment PRIMARY KEY (payment_id),
    CONSTRAINT uq_payment_subscription UNIQUE (subscription_id),
    CONSTRAINT fk_payment_subscription
        FOREIGN KEY (subscription_id)
        REFERENCES subscription (subscription_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

-- ============================================================
-- review
-- ============================================================
CREATE TABLE review (
    review_id       SERIAL      NOT NULL,
    order_item_id   INT         NOT NULL,
    user_id         INT         NOT NULL,
    rating          INT         NOT NULL,
    comment         TEXT        DEFAULT NULL,
    created_at      TIMESTAMP   NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_review PRIMARY KEY (review_id),
    CONSTRAINT uq_review_order_item UNIQUE (order_item_id),
    CONSTRAINT chk_rating CHECK (rating >= 1 AND rating <= 5),
    CONSTRAINT fk_review_order_item
        FOREIGN KEY (order_item_id)
        REFERENCES order_item (order_item_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_review_user
        FOREIGN KEY (user_id)
        REFERENCES app_user (user_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);
