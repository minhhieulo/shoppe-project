USE shoppe_db;

ALTER TABLE products ADD INDEX idx_products_category (category_id);
ALTER TABLE products ADD INDEX idx_products_brand (brand);
ALTER TABLE orders ADD INDEX idx_orders_user_created (user_id, created_at);
ALTER TABLE order_items ADD INDEX idx_order_items_product (product_id);
ALTER TABLE reviews ADD INDEX idx_reviews_product (product_id);
ALTER TABLE messages ADD INDEX idx_messages_pair (sender_id, receiver_id, created_at);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(500) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE refresh_tokens ADD INDEX idx_refresh_user (user_id);

CREATE TABLE IF NOT EXISTS password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(120) UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
