USE shoppe_db;

-- password for all seeded users: 123456
INSERT INTO users(name, email, password, role) VALUES
('Admin', 'admin@shoppe.vn', '$2a$10$BbSr.g6gZbYUR2xpg/VgL.HgmT7Sgy/fMZHSqmpcdBAXT8TpYm12y', 'admin'),
('Staff', 'staff@shoppe.vn', '$2a$10$BbSr.g6gZbYUR2xpg/VgL.HgmT7Sgy/fMZHSqmpcdBAXT8TpYm12y', 'staff'),
('User Demo', 'user@shoppe.vn', '$2a$10$BbSr.g6gZbYUR2xpg/VgL.HgmT7Sgy/fMZHSqmpcdBAXT8TpYm12y', 'user');

INSERT INTO categories(name) VALUES ('Dien thoai'), ('Laptop'), ('Phu kien'), ('Gia dung');

INSERT INTO products(name, description, price, stock, discount, category_id, brand) VALUES
('iPhone 15 Pro', 'Flagship Apple', 28990000, 50, 5, 1, 'Apple'),
('Samsung S24', 'Flagship Samsung', 23990000, 35, 8, 1, 'Samsung'),
('Macbook Air M3', 'Laptop sieu nhe', 30990000, 20, 3, 2, 'Apple'),
('Tai nghe Bluetooth', 'Chong on, pin trau', 990000, 150, 15, 3, 'SoundPro'),
('May hut bui mini', 'Nho gon, luc hut manh', 1490000, 80, 10, 4, 'HomeTech');

INSERT INTO product_images(product_id, image_url) VALUES
(1, 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800'),
(2, 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=800'),
(3, 'https://images.unsplash.com/photo-1517336714739-489689fd1ca8?w=800'),
(4, 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800'),
(5, 'https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?w=800');

INSERT INTO vouchers(code, discount_percent, min_order, expired_at, is_active) VALUES
('NEWUSER10', 10, 300000, DATE_ADD(NOW(), INTERVAL 60 DAY), 1),
('FLASH20', 20, 500000, DATE_ADD(NOW(), INTERVAL 10 DAY), 1);

INSERT INTO flash_sales(product_id, discount_percent, start_time, end_time) VALUES
(1, 12, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL 2 DAY)),
(4, 25, DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_ADD(NOW(), INTERVAL 8 HOUR));
