-- ARA inventory automation migration
-- Run this once in Supabase Dashboard -> SQL Editor.
-- New order items reserve/decrement stock. Cancelling an order restores stock;
-- moving a cancelled order back to an active status reserves stock again.
-- Existing orders are NOT backfilled automatically to avoid double-counting stock.

CREATE OR REPLACE FUNCTION public.ara_adjust_product_stock(p_product_id bigint, p_delta integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  IF p_product_id IS NULL OR p_delta = 0 THEN RETURN; END IF;

  IF p_delta < 0 THEN
    UPDATE public.products
       SET stock = COALESCE(stock, 0) + p_delta
     WHERE id = p_product_id
       AND COALESCE(stock, 0) >= -p_delta;
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected = 0 THEN
      RAISE EXCEPTION 'Insufficient stock for product id %', p_product_id;
    END IF;
  ELSE
    UPDATE public.products
       SET stock = COALESCE(stock, 0) + p_delta
     WHERE id = p_product_id;
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected = 0 THEN
      RAISE EXCEPTION 'Product id % does not exist', p_product_id;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.ara_order_item_stock_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_status text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT lower(COALESCE(order_status, 'pending')) INTO parent_status
      FROM public.orders WHERE id = NEW.order_id;
    IF COALESCE(parent_status, 'pending') <> 'cancelled' THEN
      PERFORM public.ara_adjust_product_stock(NEW.product_id, -NEW.quantity);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT lower(COALESCE(order_status, 'pending')) INTO parent_status
      FROM public.orders WHERE id = OLD.order_id;
    IF COALESCE(parent_status, 'pending') <> 'cancelled' THEN
      PERFORM public.ara_adjust_product_stock(OLD.product_id, OLD.quantity);
    END IF;
    RETURN OLD;
  ELSE
    SELECT lower(COALESCE(order_status, 'pending')) INTO parent_status
      FROM public.orders WHERE id = OLD.order_id;
    IF COALESCE(parent_status, 'pending') <> 'cancelled' THEN
      PERFORM public.ara_adjust_product_stock(OLD.product_id, OLD.quantity);
    END IF;
    SELECT lower(COALESCE(order_status, 'pending')) INTO parent_status
      FROM public.orders WHERE id = NEW.order_id;
    IF COALESCE(parent_status, 'pending') <> 'cancelled' THEN
      PERFORM public.ara_adjust_product_stock(NEW.product_id, -NEW.quantity);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS ara_order_item_stock ON public.order_items;
CREATE TRIGGER ara_order_item_stock
AFTER INSERT OR UPDATE OF product_id, quantity, order_id OR DELETE
ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.ara_order_item_stock_trigger();

CREATE OR REPLACE FUNCTION public.ara_order_status_stock_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item record;
  was_cancelled boolean;
  is_cancelled boolean;
BEGIN
  was_cancelled := lower(COALESCE(OLD.order_status, 'pending')) = 'cancelled';
  is_cancelled := lower(COALESCE(NEW.order_status, 'pending')) = 'cancelled';
  IF was_cancelled = is_cancelled THEN RETURN NEW; END IF;

  FOR item IN SELECT product_id, quantity FROM public.order_items WHERE order_id = NEW.id LOOP
    IF is_cancelled THEN
      PERFORM public.ara_adjust_product_stock(item.product_id, item.quantity);
    ELSE
      PERFORM public.ara_adjust_product_stock(item.product_id, -item.quantity);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ara_order_status_stock ON public.orders;
CREATE TRIGGER ara_order_status_stock
AFTER UPDATE OF order_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.ara_order_status_stock_trigger();

-- Prevent browser roles from directly invoking the helper. Triggers run as the function owner.
REVOKE ALL ON FUNCTION public.ara_adjust_product_stock(bigint, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ara_order_item_stock_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ara_order_status_stock_trigger() FROM PUBLIC, anon, authenticated;
