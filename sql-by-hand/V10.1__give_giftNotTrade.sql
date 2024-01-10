
-- Backup DB.

-- Test:
-- select * from jwt where claim like '%TradeAction%';

-- Record the ID for any that are in the fulfills field.
-- If they are all 'fulfills' then you can run this:
update give_claim set giftNotTrade = 0 where jwtId in (select id from jwt where claim like '%TradeAction%');

-- See if results are as expected:
-- select giftNotTrade, count(*) from give_claim group by giftNotTrade;

update give_claim set giftNotTrade = 1 where giftNotTrade is null;
